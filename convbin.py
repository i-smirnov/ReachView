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

class LogMetadata:

    def __init__(self, convbin_output):

        self.start_timestamp = 0
        self.stop_timestamp = 0

        self.navigation_messages = {
            "OBS": "0",
            "NAV": "0",
            "GNAV": "0",
            "HNAV": "0",
            "QNAV": "0",
            "LNAV": "0",
            "SBAS": "0",
            "Errors": "0"
        }

        self.extractDataFromString(convbin_output)

    def __str__(self):
        to_print = "Printing log metadata:\n"
        to_print += "Log start time == " + str(self.start_timestamp) + "\n"
        to_print += "Log stop time == " + str(self.stop_timestamp) + "\n"
        to_print += "Navigation messages parsed:\n"
        to_print += str(self.navigation_messages)

        return to_print

    def extractDataFromString(self, data_string):
        # example string:
        # 2016/01/08 09:35:02-01/08 11:24:58: O=32977 N=31 G=41 E=2

        data_list = data_string.split(" ")
        data_list = filter(None, data_list)

        # first 3 parts mark the time properties
        # the next elemets show message counts

        self.extractTimeDataFromString(data_list[:3])
        self.extractMessageCountFromString(data_list[3:])

    def extractTimeDataFromString(self, data_list):
        # example string(split into a list by spaces)
        # 2016/01/08 09:35:02-01/08 11:24:58:

        # remove all the extra punctuation
        raw_data = "".join(data_list)
        raw_data = raw_data.translate(None, "/:\r")

        start_timestamp = raw_data.split("-")[0]
        stop_timestamp = raw_data.split("-")[1]

        stop_year = self.calculateStopYear(start_timestamp, stop_timestamp)

        self.start_timestamp = start_timestamp
        self.stop_timestamp = stop_year + stop_timestamp

    def calculateStopYear(self, start_timestamp, stop_timestamp):
        # calc stop year for the stop timestamp

        start_year = int(start_timestamp[:4])
        start_month = int(start_timestamp[4:6])

        stop_month = int(stop_timestamp[0:2])

        # we assume logs can't last longer than a year
        stop_year = start_year if start_month <= stop_month else start_year + 1

        return str(stop_year)

    def extractMessageCountFromString(self, data_list):
        # example string(split into a list by spaces)
        # O=32977 N=31 G=41 E=2

        msg_dictionary = {
            "O": "OBS",
            "N": "NAV",
            "G": "GNAV",
            "H": "HNAV",
            "Q": "QNAV",
            "L": "LNAV",
            "S": "SBAS",
            "E": "Errors"
        }

        for entry in data_list:
            split_entry = entry.split("=")
            msg_type = msg_dictionary[split_entry[0]]
            msg_count = split_entry[1]

            # append the resulting data
            self.navigation_messages[msg_type] = msg_count


class CONVBIN:

    def __init__(self, RTKLIB_path):
        # only thing we need here is the full path to RTKLIB directory(without a trailing slash)
        self.bin_path = RTKLIB_path + "/app/convbin/gcc/convbin"
        self.child = 0

    def convertRTKLIBLogToRINEX(self, log_path):
        # check if log is rover or reference
        # we consider rover logs to be named "*rov*"
        # base logs to be named "*ref*" as default in RTKLIB

        if "rov_" in log_path:
            # rover log, ubx format
            self.convertLogToRINEX("ubx", log_path)
        elif "ref_" in log_path:
            # ref log, try rtcm3 format
            self.convertLogToRINEX("rtcm3", log_path)

    def convertLogToRINEX(self, format, log_path):
        # call convbin to convert log with specified format a

        spawn_command = " ".join([self.bin_path, "-r", format, log_path])

        print("Converting " + log_path + "...")
        print("Specified format is " + format)

        # run the conversion
        self.child = pexpect.spawn(spawn_command, echo = False)
        self.child.expect(pexpect.EOF)

        return self.parseCONVBINOutput(self.child.before)

    def parseCONVBINOutput(self, output):
        # determine whether conversion was a success

        # extract the last printed version of the output
        # which is between the carriage return chars
        lmd = LogMetadata(self.extractResultingString(output))
        print(str(lmd))

    def extractResultingString(self, output):
        # get the last line of the convbin output

        last_line_end = output.rfind("\r\r\n")
        last_line_start = output.rfind("\r", 0, last_line_end) + 1

        return output[last_line_start:last_line_end]


if __name__ == "__main__":
    cb = CONVBIN("/home/egor/RTK")
    cb.convertRTKLIBLogToRINEX("/home/egor/RTK/test_logs/rov_201601110833.log")


