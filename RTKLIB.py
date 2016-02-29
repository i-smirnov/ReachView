# ReachView code is placed under the GPL license.
# Written by Egor Fedorov (egor.fedorov@emlid.com)
# Copyright (c) 2015, Emlid Limited
# All rights reserved.

# If you are interested in using ReachView code as a part of a
# closed source project, please contact Emlid Limited (info@emlid.com).

# This file is part of ReachView.

# ReachView is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# ReachView is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with ReachView.  If not, see <http://www.gnu.org/licenses/>.

from RtkController import RtkController
from ConfigManager import ConfigManager
from Str2StrController import Str2StrController
from LogManager import LogManager
from ReachLED import ReachLED

import json
import time
import os
import signal
import zipfile

from subprocess import check_output, Popen, PIPE
from threading import Semaphore, Thread

# master class for working with all RTKLIB programmes
# prevents them from stacking up and handles errors
# also handles all data broadcast through websockets

class RTKLIB:

    # we will save RTKLIB state here for later loading
    state_file = "/home/reach/.reach/rtk_state"

    def __init__(self, socketio, rtklib_path = None, enable_led = True, log_path = None):


        if rtklib_path is None:
            rtklib_path = "/home/reach/RTKLIB"

        if log_path is None:
            log_path = "/home/reach/logs"

        # default state for RTKLIB is "rover single"
        self.state = "rover"

        # we need this to broadcast stuff
        self.socketio = socketio

        # these are necessary to handle rover mode
        self.rtkc = RtkController(rtklib_path)
        self.conm = ConfigManager(rtklib_path)

        # this one handles base settings
        self.s2sc = Str2StrController(rtklib_path)

        # take care of serving logs
        self.logm = LogManager(rtklib_path, log_path)

        # basic synchronisation to prevent errors
        self.semaphore = Semaphore()

        # we need this to send led signals
        self.enable_led = enable_led

        if self.enable_led:
            self.led = ReachLED()

        # broadcast satellite levels and status with these
        self.server_not_interrupted = True
        self.satellite_thread = None
        self.coordinate_thread = None
        self.conversion_thread = None

        # we try to restore previous state
        # in case we can't, we start as rover in single mode
        self.loadState()

    def launchRover(self, config_name = None):
        # config_name may be a name, or a full path
        # if the parameter contains "/", then we consider it a full path
        # else, we will be looking for it one directory higher than the rtkrcv bin

        self.semaphore.acquire()
        print("Attempting to launch rtkrcv...")

        if config_name == None:
            res = self.rtkc.launch()
        else:
            res = self.rtkc.launch(config_name)

        if res < 0:
            print("rtkrcv launch failed")
        elif res == 1:
            print("rtkrcv launch successful")
            self.state = "rover"
        elif res == 2:
            print("rtkrcv already launched")
            self.state = "rover"

        self.saveState()

        if self.enable_led:
            self.updateLED()

        print("Rover mode launched")

        self.semaphore.release()

        return res

    def shutdownRover(self):

        self.stopRover()

        self.semaphore.acquire()
        print("Attempting rtkrcv shutdown")

        res = self.rtkc.shutdown()

        if res < 0:
            print("rtkrcv shutdown failed")
        elif res == 1:
            print("rtkrcv shutdown successful")
            self.state = "inactive"
        elif res == 2:
            print("rtkrcv already shutdown")
            self.state = "inactive"

        self.saveState()

        if self.enable_led:
            self.updateLED()

        print("Rover mode shutdown")

        self.semaphore.release()

        return res

    def startRover(self):

        self.semaphore.acquire()
        print("Attempting to start rtkrcv...")

        res = self.rtkc.start()

        if res == -1:
            print("rtkrcv start failed")
        elif res == 1:
            print("rtkrcv start successful")
            print("Starting coordinate and satellite broadcast")
        elif res == 2:
            print("rtkrcv already started")

        # start fresh data broadcast

        self.server_not_interrupted = True

        if self.satellite_thread is None:
            self.satellite_thread = Thread(target = self.broadcastSatellites)
            self.satellite_thread.start()

        if self.coordinate_thread is None:
            self.coordinate_thread = Thread(target = self.broadcastCoordinates)
            self.coordinate_thread.start()

        self.saveState()

        if self.enable_led:
            self.updateLED()

        self.semaphore.release()

        return res

    def stopRover(self):

        self.semaphore.acquire()
        print("Attempting to stop RTKLIB...")

        res = self.rtkc.stop()

        if res == -1:
            print("rtkrcv stop failed")
        elif res == 1:
            print("rtkrcv stop successful")
        elif res == 2:
            print("rtkrcv already stopped")

        self.server_not_interrupted = False

        if self.satellite_thread is not None:
            self.satellite_thread.join()
            self.satellite_thread = None

        if self.coordinate_thread is not None:
            self.coordinate_thread.join()
            self.coordinate_thread = None

        self.saveState()

        if self.enable_led:
            self.updateLED()

        self.semaphore.release()

        return res

    def launchBase(self):
        # due to the way str2str works, we can't really separate launch and start
        # all the configuration goes to startBase() function
        # this launchBase() function exists to change the state of RTKLIB instance
        # and to make the process for base and rover modes similar

        self.semaphore.acquire()

        self.state = "base"

        self.saveState()

        if self.enable_led:
            self.updateLED()

        print("Base mode launched")

        self.semaphore.release()

    def shutdownBase(self):
        # due to the way str2str works, we can't really separate launch and start
        # all the configuration goes to startBase() function
        # this shutdownBase() function exists to change the state of RTKLIB instance
        # and to make the process for base and rover modes similar

        self.stopBase()

        self.semaphore.acquire()

        self.state = "inactive"

        self.saveState()

        if self.enable_led:
            self.updateLED()

        print("Base mode shutdown")

        self.semaphore.release()

    def startBase(self, rtcm3_messages = None, base_position = None, gps_cmd_file = None):

        self.semaphore.acquire()

        print("Attempting to start str2str...")

        if not self.rtkc.started:
            res = self.s2sc.start(rtcm3_messages, base_position, gps_cmd_file)

            if res < 0:
                print("str2str start failed")
            elif res == 1:
                print("str2str start successful")
            elif res == 2:
                print("str2str already started")
        else:
            print("Can't start str2str with rtkrcv still running!!!!")

        self.saveState()

        if self.enable_led:
            self.updateLED()

        self.semaphore.release()

        return res

    def stopBase(self):

        self.semaphore.acquire()

        print("Attempting to stop str2str...")

        res = self.s2sc.stop()

        if res == -1:
            print("str2str stop failed")
        elif res == 1:
            print("str2str stop successful")
        elif res == 2:
            print("str2str already stopped")

        self.saveState()

        if self.enable_led:
            self.updateLED()

        self.semaphore.release()

        return res

    def readConfigBase(self):

        self.semaphore.acquire()

        print("Got signal to read base config")

        self.socketio.emit("current config base", self.s2sc.readConfig(), namespace = "/test")

        self.semaphore.release()

    def writeConfigBase(self, config):

        self.semaphore.acquire()

        print("Got signal to write base config")

        self.s2sc.writeConfig(config)

        print("Restarting str2str...")

        res = self.s2sc.stop() + self.s2sc.start()

        if res > 1:
            print("Restart successful")
        else:
            print("Restart failed")

        self.saveState()

        if self.enable_led:
            self.updateLED()

        self.semaphore.release()

        return res

    def writeConfigRover(self, config):
        # config dict must include config_name field

        self.semaphore.acquire()

        if "config_file_name" not in config:
            config_file = None
        else:
            config_file = config["config_file_name"]

        print("Got signal to write rover config to file " + config_file)

        self.conm.writeConfig(config_file, config)

        self.conm.updateAvailableConfigs()

        # send available configs to the browser
        self.socketio.emit("available configs", {"available_configs": self.conm.available_configs}, namespace="/test")

        self.semaphore.release()

    def loadConfigRover(self, config_file = None):
        # we might want to write the config, but dont need to load it every time

        self.semaphore.acquire()

        if config_file == None:
            config_file == self.conm.default_rover_config

        print("Loading config " + config_file)

        # loading config to rtkrcv
        if self.rtkc.loadConfig(config_file) < 0:
            print("ERROR: failed to load config!!!")
            print("abort load")
            self.semaphore.release()

            return -1

        print("load successful!")
        print("Now we need to restart rtkrcv for the changes to take effect")

        if self.rtkc.started:
            print("rtkrcv is already started, we need to do a simple restart!")

            res = self.rtkc.restart()

            if res == 3:
                print("Restart successful")
                print(config_file + " config loaded")
            elif res == 1:
                print("rtkrcv started instead of restart")
            elif res < 1:
                print("ERROR: rtkrcv restart failed")

            self.semaphore.release()

            self.saveState()

            return res
        else:
            print("We were not started before, so we need to perform a full start")

            self.semaphore.release()

            return self.startRover()

    def readConfigRover(self, config):

        self.semaphore.acquire()

        if "config_file_name" not in config:
            config_file = None
        else:
            config_file = config["config_file_name"]

        print("Got signal to read the rover config by the name " + str(config_file))
        print("Sending rover config " + str(config_file))

        # read from file
        self.conm.readConfig(config_file)

        # send to the browser
        self.socketio.emit("current config rover", self.conm.buffered_config.items, namespace="/test")

        self.semaphore.release()

    def shutdown(self):
        # shutdown whatever mode we are in. stop broadcast threads

        # clean up broadcast and blink threads
        self.server_not_interrupted = False
        self.led.blinker_not_interrupted = False

        if self.coordinate_thread is not None:
            self.coordinate_thread.join()

        if self.satellite_thread is not None:
            self.satellite_thread.join()

        if self.led.blinker_thread is not None:
            self.led.blinker_thread.join()

        # shutdown base or rover
        if self.state == "rover":
            return self.shutdownRover()
        elif self.state == "base":
            return self.shutdownBase()

        # otherwise, we are inactive
        return 1

    def deleteConfig(self, config_name):
        # pass deleteConfig to conm

        print("Got signal to delete config " + config_name)

        self.conm.deleteConfig(config_name)

        self.conm.updateAvailableConfigs()

        # send available configs to the browser
        self.socketio.emit("available configs", {"available_configs": self.conm.available_configs}, namespace="/test")

        print(self.conm.available_configs)

    def resetConfigToDefault(self, config_name):
        # pass reset config to conm

        print("Got signal to reset config " + config_name)

        self.conm.resetConfigToDefault(config_name)

        self.conm.updateAvailableConfigs()

        # send available configs to the browser
        self.socketio.emit("available configs", {"available_configs": self.conm.available_configs}, namespace="/test")

        print(self.conm.available_configs)

    def cancelLogConversion(self, raw_log_path):
        if self.logm.log_being_converted:
            print("Canceling log conversion for " + raw_log_path)

            self.logm.convbin.child.kill(signal.SIGINT)

            self.conversion_thread.join()
            self.logm.convbin.child.close(force = True)

            print("Thread killed")
            self.logm.cleanLogFiles(raw_log_path)
            self.logm.log_being_converted = ""

            print("Canceled msg sent")

    def processLogPackage(self, raw_log_path):

        currently_converting = False

        try:
            print("conversion thread is alive " + str(self.conversion_thread.isAlive()))
            currently_converting = self.conversion_thread.isAlive()
        except AttributeError:
            pass

        log_filename = os.path.basename(raw_log_path)
        potential_zip_path = os.path.splitext(raw_log_path)[0] + ".zip"

        can_send_file = True

        # can't send if there is no converted package and we are busy
        if (not os.path.isfile(potential_zip_path)) and (currently_converting):
            can_send_file = False

        if can_send_file:
            print("Starting a new bg conversion thread for log " + raw_log_path)
            self.logm.log_being_converted = raw_log_path
            self.conversion_thread = Thread(target = self.getRINEXPackage, args = (raw_log_path, ))
            self.conversion_thread.start()
        else:
            error_msg = {
                "name": os.path.basename(raw_log_path),
                "conversion_status": "A log is being converted at the moment. Please wait",
                "messages_parsed": ""
            }
            self.socketio.emit("log conversion failed", error_msg, namespace="/test")

    def conversionIsRequired(self, raw_log_path):
        log_filename = os.path.basename(raw_log_path)
        potential_zip_path = os.path.splitext(raw_log_path)[0] + ".zip"

        if os.path.isfile(potential_zip_path):
            print("Raw logs differ " + str(self.rawLogsDiffer(raw_log_path, potential_zip_path)))
            return self.rawLogsDiffer(raw_log_path, potential_zip_path)
        else:
            print("No zip file!!! Conversion required")
            return True

    def rawLogsDiffer(self, raw_log_path, zip_package_path):
        # check if the raw log is the same size in the zip and in filesystem
        log_name = os.path.basename(raw_log_path)
        raw_log_size = os.path.getsize(raw_log_path)

        zip_package = zipfile.ZipFile(zip_package_path)
        raw_file_inside_info = zip_package.getinfo("Raw/" + log_name)
        raw_file_inside_size = raw_file_inside_info.file_size

        if raw_log_size == raw_file_inside_size:
            return False
        else:
            return True

    def getRINEXPackage(self, raw_log_path):
        # if this is a solution log, return the file right away
        if raw_log_path.endswith("pos"):
            log_url_tail = "/logs/download/" + os.path.basename(raw_log_path)
            self.socketio.emit("log download path", {"log_url_tail": log_url_tail}, namespace="/test")
            return raw_log_path

        # return RINEX package if it already exists
        # create one if not
        log_filename = os.path.basename(raw_log_path)
        potential_zip_path = os.path.splitext(raw_log_path)[0] + ".zip"
        result_path = ""

        if self.conversionIsRequired(raw_log_path):
            print("Conversion is Required!")
            result_path = self.createRINEXPackage(raw_log_path)
            # handle canceled conversion
            if result_path is None:
                log_url_tail = "/logs/download/" + os.path.basename(raw_log_path)
                self.socketio.emit("log download path", {"log_url_tail": log_url_tail}, namespace="/test")
                return None
        else:
            result_path = potential_zip_path
            print("Conversion is not Required!")
            already_converted_package = {
                "name": log_filename,
                "conversion_status": "Log already converted. Details inside the package",
                "messages_parsed": ""
            }
            self.socketio.emit("log conversion results", already_converted_package, namespace="/test")

        log_url_tail = "/logs/download/" + os.path.basename(result_path)
        self.socketio.emit("log download path", {"log_url_tail": log_url_tail}, namespace="/test")

        self.cleanBusyMessages()
        self.logm.log_being_converted = ""

        return result_path

    def cleanBusyMessages(self):
        # if user tried to convert other logs during conversion, he got an error message
        # this function clears them to show it's ok to convert again
        self.socketio.emit("clean busy messages", {}, namespace="/test")

    def createRINEXPackage(self, raw_log_path):
        # create a RINEX package before download
        # in case we fail to convert, return the raw log path back
        result = raw_log_path
        log_filename = os.path.basename(raw_log_path)

        conversion_time_string = self.logm.calculateConversionTime(raw_log_path)

        start_package = {
            "name": log_filename,
            "conversion_time": conversion_time_string
        }

        conversion_result_package = {
            "name": log_filename,
            "conversion_status": "",
            "messages_parsed": "",
            "log_url_tail": ""
        }

        self.socketio.emit("log conversion start", start_package, namespace="/test")
        try:
            log = self.logm.convbin.convertRTKLIBLogToRINEX(raw_log_path, self.logm.getRINEXVersion())
        except ValueError, IndexError:
            print("Conversion canceled")
            conversion_result_package["conversion_status"] = "Conversion canceled, downloading raw log"
            self.socketio.emit("log conversion results", conversion_result_package, namespace="/test")
            return None

        print("Log conversion done!")

        if log is not None:
            result = log.createLogPackage()
            if log.isValid():
                conversion_result_package["conversion_status"] = "Log converted to RINEX"
                conversion_result_package["messages_parsed"] = log.log_metadata.formValidMessagesString()
            else:
                conversion_result_package["conversion_status"] = "Conversion successful, but log does not contain any useful data. Downloading raw log"
        else:
            print("Could not convert log. Is the extension wrong?")
            conversion_result_package["conversion_status"] = "Log conversion failed. Downloading raw log"

        self.socketio.emit("log conversion results", conversion_result_package, namespace="/test")

        print("Log conversion results:")
        print(str(log))

        return result

    def saveState(self):
        # save current state for future resurrection:
        # state is a list of parameters:
        # rover state example: ["rover", "started", "reach_single_default.conf"]
        # base state example: ["base", "stopped", "input_stream", "output_stream"]

        state = {}

        # save "rover", "base" or "inactive" state
        state["state"] = self.state

        if self.state == "rover":
            started = self.rtkc.started
        elif self.state == "base":
            started = self.s2sc.started
        elif self.state == "inactive":
            started = False

        state["started"] = "yes" if started else "no"

        # dump rover state
        state["rover"] = {"current_config": self.rtkc.current_config}

        # dump rover state
        state["base"] = {
            "input_stream": self.s2sc.input_stream,
            "output_stream": self.s2sc.output_stream,
            "rtcm3_messages": self.s2sc.rtcm3_messages,
            "base_position": self.s2sc.base_position,
            "gps_cmd_file": self.s2sc.gps_cmd_file
        }

        print("DEBUG saving state")
        print(str(state))

        with open(self.state_file, "w") as f:
            json.dump(state, f, sort_keys = True, indent = 4)

        return state

    def byteify(self, input):
        # thanks to Mark Amery from StackOverflow for this awesome function
        if isinstance(input, dict):
            return {self.byteify(key): self.byteify(value) for key, value in input.iteritems()}
        elif isinstance(input, list):
            return [self.byteify(element) for element in input]
        elif isinstance(input, unicode):
            return input.encode('utf-8')
        else:
            return input

    def getState(self):
        # get the state, currently saved in the state file
        print("Trying to read previously saved state...")

        try:
            f = open(self.state_file, "r")
        except IOError:
            # can't find the file, let's create a new one with default state
            print("Could not find existing state, Launching default single rover mode...")

            return 1
        else:

            print("Found existing state...trying to decode...")

            try:
                json_state = json.load(f)
            except ValueError:
                # could not properly decode current state
                print("Could not decode json state. Launching single rover mode as default...")
                f.close()

                return 1
            else:
                print("Decoding succesful")

                f.close()

                # convert unicode strings to normal
                json_state = self.byteify(json_state)

                print("That's what we found:")
                print(str(json_state))

                return json_state

    def loadState(self):

        # get current state
        json_state = self.getState()

        if json_state == 1:
            # we dont need to load as we were forced to start
            # as default single rover due to corrupt/missing state file

            self.launchRover()

            # for the first start, just let it be green
            self.updateLED("green")

            return

        print("Now loading the state printed above... ")

        # first, we restore the base state, because no matter what we end up doing,
        # we need to restore base state

        self.s2sc.input_stream = json_state["base"]["input_stream"]
        self.s2sc.output_stream = json_state["base"]["output_stream"]
        self.s2sc.rtcm3_messages = json_state["base"]["rtcm3_messages"]
        self.s2sc.base_position = json_state["base"]["base_position"]
        self.s2sc.gps_cmd_file = json_state["base"]["gps_cmd_file"]

        if json_state["state"] == "rover":
            saved_config = json_state["rover"]["current_config"]

            if saved_config == "":
                saved_config = None

            self.launchRover(saved_config)

            if json_state["started"] == "yes":
                self.startRover()

        elif json_state["state"] == "base":
            self.launchBase()

            if json_state["started"] == "yes":
                self.startBase()

        else:
            # in case we are inactive
            self.launchRover()

        print(str(json_state["state"]) + " state loaded")

    def sendState(self):
        # send current state to every connecting browser

        state = self.getState()

        self.conm.updateAvailableConfigs()
        state["available_configs"] = self.conm.available_configs

        print("Available configs to send: ")
        print(str(state["available_configs"]))

        self.socketio.emit("current state", state, namespace = "/test")

    def updateLED(self, pattern = None):
        # this forms a distinctive and informative blink pattern showing following info:
        # network_status/rtk_mode/started?/solution_status
        # network: self-hosted AP or connected? green/blue
        # rtk mode: rover or base? blue/magenta
        # started: yes or no? green/red
        # solution status: -, single, float, fix? red/cyan/yellow/green

        blink_pattern = []
        delay = 0.5

        # get wi-fi connection status for the first signal

        cmd = ["configure_edison", "--showWiFiMode"]
        cmd = " ".join(cmd)

        proc = Popen(cmd, stdout = PIPE, shell = True, bufsize = 2048)
        out = proc.communicate()

        out = out[0].split("\n")[0]

        if out == "Master":
            blink_pattern.append("green")
        elif out == "Managed":
            blink_pattern.append("blue")

        if self.state == "base":

            blink_pattern.append("magenta")

            if self.s2sc.started:
                # we have a started base
                blink_pattern.append("green")
            else:
                # we have a stopped base
                blink_pattern.append("red")

            # for now, the base doesn't have solution
            blink_pattern.append("off")

        elif self.state == "rover":

            blink_pattern.append("blue")

            if self.rtkc.started:
                # we have a started rover

                blink_pattern.append("green")

                status_pattern_dict = {
                    "fix": "green,off",
                    "float": "yellow,off",
                    "single": "cyan,off",
                    "-": "read,off"
                }

                # we need to acquire RtkController in case it's currently updating info dict
                self.rtkc.semaphore.acquire()
                current_rover_solutuon_status = self.rtkc.info.get("solution_status", "")
                self.rtkc.semaphore.release()

                # if we don't know this status, we just pass
                blink_pattern.append(status_pattern_dict.get(current_rover_solutuon_status, "off"))
            else:
                # we have a stopped rover
                blink_pattern.append("red")
                # we are not started, meaning no status just yet
                blink_pattern.append("off")

        # sync color for better comprehension
        blink_pattern.append("white")

        # concatenate all that into one big string
        blink_pattern = ",off,".join(blink_pattern) + ",off"

        if pattern is not None:
            blink_pattern = pattern

        if blink_pattern:
            # check blink_pattern contains something new
            if blink_pattern != self.led.current_blink_pattern:
                # if we decided we need a new pattern, then start blinking it
                self.led.startBlinker(blink_pattern, delay)

    def timeUpdateRequired(self, old_status, new_status):
        # update time if we moved from "-" status to single/float/whatever
        if old_status == "-" and new_status != "-":
            return True
        else:
            return False

    def updateSystemTime(self, date, time):
        # requires a date list and a time list
        # ["YYYY", "MM", "DD"], ["hh", "mm", "ss"]
        print("##### UPDATING SYSTEM TIME #####")
        print(date)
        print(time)
        return

    # thread workers for broadcasing rtkrcv status

    # this function reads satellite levels from an exisiting rtkrcv instance
    # and emits them to the connected browser as messages
    def broadcastSatellites(self):
        count = 0

        while self.server_not_interrupted:

            # update satellite levels
            self.rtkc.getObs()

            if count % 10 == 0:
                print("Sending sat rover levels:\n" + str(self.rtkc.obs_rover))
                print("Sending sat base levels:\n" + str(self.rtkc.obs_base))

            self.socketio.emit("satellite broadcast rover", self.rtkc.obs_rover, namespace = "/test")
            self.socketio.emit("satellite broadcast base", self.rtkc.obs_base, namespace = "/test")
            count += 1
            time.sleep(1)

    # this function reads current rtklib status, coordinates and obs count
    def broadcastCoordinates(self):
        count = 0

        while self.server_not_interrupted:

            # get current solution status
            current_solution_status = self.rtkc.status.get("solution status", None)

            # update RTKLIB status
            self.rtkc.getStatus()

            new_solution_status = self.rtkc.status.get("solution status", None)

            if self.timeUpdateRequired(current_solution_status, new_solution_status):
                date_list, time_list = self.rtkc.gps_datetime
                self.updateSystemTime(date_list, time_list)

            if count % 10 == 0:
                print("Sending RTKLIB status select information:")
                print(self.rtkc.status)

            self.socketio.emit("coordinate broadcast", self.rtkc.info, namespace = "/test")

            if self.enable_led:
                self.updateLED()

            count += 1
            time.sleep(1)
