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

import pexpect
from threading import Lock, Thread
import time

# throw this exception when we an error in rtkrcv config file
class RtkrcvConfigError(Exception):
    pass

# This module automates working with RTKRCV directly
# You can get sat levels, current status, start and restart the software

class Rtkrcv:

    def __init__(self, rtklib_path):

        self.bin_path = rtklib_path + "/app/rtkrcv/gcc"
        self.config_path = rtklib_path + "/app/rtkrcv"
        self.child = 0

        self.launched = False
        self.current_config = ""

        self.status = {}
        self.stream_status = {}

        self.obs_rover = {}
        self.obs_base = {}

        self.info = {}

        # prevent the rtkrcv prompt from being used simultaneously
        self.mutex = Lock()

    def launch(self, config_name):
        # run an rtkrcv instance with the specified config:
        # if there is a slash in the name we consider it a full location
        # otherwise, it's supposed to be in the upper directory(rtkrcv inside app)

        if not self.launched:

            self.mutex.acquire()

            spawn_command = self.bin_path + "/rtkrcv -s -o " + self.config_path + "/" + config_name
            self.child = pexpect.spawn(spawn_command, cwd = self.bin_path, echo = False)

            print('Launching rtkrcv with: "' + spawn_command + '"')
            launch_failed = self.child.expect(["rtkrcv>", pexpect.EOF])

            if launch_failed:
                self.mutex.release()
                raise RtkrcvConfigError(config_name)

            self.launched = True
            self.current_config = config_name

            self.mutex.release()

            # launch success
            return 1

        # already launched
        return 2

    def shutdown(self):

        if self.launched:
            self.mutex.acquire()

            self.child.send("shutdown\r\n")

            a = self.child.expect([":", pexpect.EOF, "error"])

            if a > 0:
                print("Stop error")
                r = -1
            else:
                self.child.send("y\r\n")
                r = 1

            # wait for rtkrcv to shutdown
            try:
                self.child.wait()
            except pexpect.ExceptionPexpect:
                print("Already dead!!")

            if self.child.isalive():
                r = -1

            self.mutex.release()

            self.launched = False

            return r

        # already shut down
        return 2

    def get_status(self):

        self.mutex.acquire()

        self.child.send("status\r\n")
        cmd_failed = self.child.expect(["rtkrcv>", pexpect.EOF])

        if cmd_failed:
            self.mutex.release()
            return -1

        # time to extract information from the status form
        status = self.child.before.split("\r\n")

        if status != {}:

            # print("Got status!!!:")

            for line in status:
                spl = line.split(":")

                if len(spl) > 1:
                    # get rid of extra whitespace

                    param = spl[0].strip()
                    value = spl[1].strip()

                    self.status[param] = value

                    # print(param + ":::"  + value)

                    # print("Gotten status:\n" + str(self.status))

            if self.status != {}:
                # print("Current status:\n" + str(self.status))
                self.info = {}


                for key in self.status:
                    # we want to parse all the messages received by rover, base or corr
                    # this entry has a form of "# of input data rover"
                    if key.startswith("# of input data"):
                        # first we figure out what is this - rover, base or corr
                        msg_from = key.rsplit(" ", 1)[1]

                        # after split the message information has the form of "obs(100)" or "ion(10)"
                        # split the messages by type
                        input_messages = self.status[key].split(",")

                        # the order for the messages is:
                        # obs(0),nav(0),gnav(0),ion(0),sbs(0),pos(0),dgps(0),ssr(0),err(0)
                        for msg in input_messages:
                            first_bracket_index = msg.find("(")
                            msg_type = msg[:first_bracket_index]
                            msg_amount_received = msg[first_bracket_index + 1:msg.find(")")]
                            # we save them in the form of self.info["obs_rover"] = "10"
                            self.info[msg_type + "_" + msg_from] = msg_amount_received

                    if key.startswith("# of rtcm messages"):
                        # first we figure out what is this - rover, base or corr
                        msg_from = key.rsplit(" ", 1)[1]

                        # after split the message information has the form of "1010(100)" or "1002(10)"
                        # split the messages by type
                        # unlike input data, this one can be empty, thus extra if
                        if self.status[key]:
                            input_messages = self.status[key].split(",")

                            # the order for the messages is:
                            # obs(0),nav(0),gnav(0),ion(0),sbs(0),pos(0),dgps(0),ssr(0),err(0)
                            for msg in input_messages:
                                first_bracket_index = msg.find("(")
                                msg_type = msg[:first_bracket_index]
                                msg_amount_received = msg[first_bracket_index + 1:msg.find(")")]
                                # we save them in the form of self.info["obs_rover"] = "10"
                                self.info["rtcm_" + msg_type + "_" + msg_from] = msg_amount_received

                    if key.startswith("# of satellites"):
                        msg_from = key.rsplit(" ", 1)[1]

                        if self.status[key]:
                            self.info["satellites_" + msg_from] = self.status[key]

                    if key == "# of valid satellites":
                        self.info["satellites_valid"] = self.status[key]


                    if key == "solution status":
                        self.info["solution_status"] = self.status[key]

                    if key == "positioning mode":
                        self.info["positioning_mode"] = self.status[key]

                    if key == "age of differential (s)":
                        self.info["age_of_differential"] = self.status[key]

                    if key == "pos llh single (deg,m) rover":
                        llh = self.status[key].split(",")
                        if len(llh) > 2:
                            lat = llh[0]
                            lon = llh[1]
                            height = llh[2]

                            self.info["lat"] = lat
                            self.info["lon"] = lon
                            self.info["height"] = height

        self.mutex.release()

        return 1

    def get_observations(self):

        self.mutex.acquire()

        self.obs_rover = {}
        self.obs_base = {}

        self.child.send("obs\r\n")
        cmd_failed = self.child.expect(["rtkrcv>", pexpect.EOF])

        if cmd_failed:
            self.mutex.release()
            return -1

        # time to extract information from the obs form
        obs = self.child.before.split("\r\n")

        # strip out empty lines
        obs = filter(None, obs)

        # check for the header string
        matching_strings = [s for s in obs if "SAT" in s]

        if matching_strings != []:
            # find the header of the OBS table
            header_index = obs.index(matching_strings[0])

            # split the header string into columns
            header = obs[header_index].split()

            if "S1" in header:
                # find the indexes of the needed columns
                sat_name_index = header.index("SAT")
                sat_level_index = header.index("S1")
                sat_input_source_index = header.index("R")

                if len(obs) > (header_index + 1):
                    # we have some info about the actual satellites:

                    self.obs_rover = {}
                    self.obs_base = {}

                    for line in obs[header_index+1:]:
                        spl = line.split()

                        if len(spl) > sat_level_index:
                            name = spl[sat_name_index]
                            level = spl[sat_level_index]

                            # R parameter corresponds to the input source number
                            if spl[sat_input_source_index] == "1":
                                # we consider 1 to be rover,
                                self.obs_rover[name] = level
                            elif spl[sat_input_source_index] == "2":
                                # 2 to be base
                                self.obs_base[name] = level

                else:
                    self.obs_base = {}
                    self.obs_rover = {}

        self.mutex.release()

        return 1

    def get_stream_status(self):

        self.mutex.acquire()

        self.stream_status = {}

        self.child.send("stream\r\n")

        cmd_failed = self.child.expect(["rtkrcv>", pexpect.EOF])

        if cmd_failed:
            self.mutex.release()
            return -1

        stream_status_output = self.child.before.split("\r\n")

        print("Before parsing:")
        print(stream_status_output)

        self.stream_status = RtkrcvStreamStatus(stream_status_output).stream_status

        self.mutex.release()

        return 1


class RtkrcvStreamStatus:

    table_header = ["Stream", "Type", "Format", "Status", "In-bytes", "In-bps", "Out-bytes", "Out-bps", "Message"]

    def __init__(self, rtkrcv_output):
        # parse output of rtkrcv command "stream"
        self.stream_status = self.parse_stream_status(rtkrcv_output)

    def __str__(self):

        to_print = "Printing rtkrcv stream status:\n"

        for name, properties in self.stream_status.iteritems():
            to_print += "Stream: " + name + "\n"

            for stream_property in self.table_header[1:]:
                if stream_property in properties:
                    to_print += stream_property + ": " + properties[stream_property] + ", "

            to_print += "\n"

        return to_print

    def parse_stream_status(self, rtkrcv_output):
        # stream_status is a list of lines returned by rtkrcv

        # find the start of the table
        header_index = self.find_header_index(rtkrcv_output)

        if header_index is None:
            # if no header is found, input data is invalid
            return None

        header = rtkrcv_output[header_index]
        stream_table = rtkrcv_output[header_index + 1:]

        # parse the rest of the strings, getting statuses for different streams
        return self.parse_stream_table(stream_table)

    def find_header_index(self, stream_status):
        # Table header starts with the word "Stream"

        for ind, line in enumerate(stream_status):
            if "Stream" in line:
                return ind

        return None

    def parse_stream_table(self, streams):
        # example line containing a stream:
        # input rover serial ubx c num num num num [message]

        stream_info = {}

        for line in streams:
            stream_properties = line.split()

            # check empty lines
            if stream_properties:
                # concatenate stream name!
                if stream_properties[0] != "monitor":
                    stream_properties = [" ".join(stream_properties[0:2])] + stream_properties[2:]

                print(stream_properties)

                stream_entry = self.parse_stream_entry(stream_properties)
                stream_info.update(stream_entry)

        return stream_info

    def parse_stream_entry(self, stream_properties):
        # convert a list of properties to a dict of properties

        # create a dict of all stream's properties
        stream_entry = dict(zip(self.table_header, stream_properties))

        # transform it into a {"stream_name": "properties"}
        return {stream_entry.pop("Stream"): stream_entry}


if __name__ == "__main__":

    print("Running rtkrcv tests!")
    rtkrcv = Rtkrcv("/home/reach/RTKLIB")

    try:
        rtkrcv.launch("reach_single_default.conf")
    except RtkrcvConfigError, config_name:
        print("Could not start rtkrcv due to an error in " + str(config_name))

    print("Received status " + str(rtkrcv.get_status()))
    print("Received obs " + str(rtkrcv.get_observations()))
    print("Received stream status " + str(rtkrcv.get_stream_status()))

    raw_input("Press enter to shutdown!")
    print(rtkrcv.shutdown())

    print(rtkrcv.status)
    print(rtkrcv.obs_base)
    print(rtkrcv.obs_rover)
    print(rtkrcv.stream_status)








