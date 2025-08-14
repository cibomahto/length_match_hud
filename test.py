from kipy import KiCad
from kipy import util
import kipy.errors
import time

class context:
    def __init__(self, board = None):
        if board is None:
            try:
                kicad = KiCad()
                print(f"Connected to KiCad {kicad.get_version()}")
            except BaseException as e:
                print(f"Not connected to KiCad: {e}")

            self.board = kicad.get_board()
        else:
            self.board = board

    def net_lengths(self, filter):
        nets = {}

        for net in self.board.get_nets():
            if net.name.startswith(filter):
                nets[net.name] = {'length':0, 'via_count':0}
                # netclass = self.board.get_netclass_for_nets(net)[net.name]

        # Sum lengths of all tracks, in all layers. Note that this includes any stubs
        # TODO: Sum lengths separately for each layer
        for track in self.board.get_tracks():
            if track.net.name in nets:
                net = nets[track.net.name]

                #print(track.net, track.length())
                net['length'] += util.units.to_mm(track.length())

        for via in self.board.get_vias():
            if via.net.name in nets:
                net = nets[via.net.name]

                net['via_count'] += 1

        return nets

    def select_net(self, net):
        self.board.clear_selection()

        for track in self.board.get_tracks():
            if track.net.name == net:
                self.board.add_to_selection(track)

        for via in self.board.get_vias():
            if via.net.name == net:
                self.board.add_to_selection(via)

        for pad in self.board.get_pads():
            if pad.net.name == net:
                self.board.add_to_selection(pad)

if __name__=='__main__':
    ctx = context()

    ctx.select_net("/iMX6 DDR RAM/DRAM_DATA13")

    while True:
        try:
            nets = ctx.net_lengths("/iMX6 DDR RAM/DRAM")

            clock_len = util.units.to_mm(nets['/iMX6 DDR RAM/DRAM_SDCLK0_P']['length'])

            for key, val in nets.items():
                length = val['length']
                diff = length - clock_len
                print(f"{key:30s}  {length:6.2f}  {diff:7.2f}  {val['via_count']:3d}")


            print("\n\n")
        except kipy.errors.ApiError as e:
            pass
        time.sleep(1)

