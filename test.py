from kipy import KiCad
from kipy import util
import kipy.errors
import time
from threading import Lock

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
        
        self.board_lock = Lock()
    
    def get_nets(self):
        nets = []

        with self.board_lock:
            for net in self.board.get_nets():
                nets.append(net.name)
        
        return nets

    def net_lengths(self, filter):
        nets = {}

        with self.board_lock:
            for net in self.board.get_nets():
                #if net.name.startswith(filter):
                if net.name.find(filter) != -1:
                    nets[net.name] = {'length':0, 'via_count':0}

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
        items = []

        with self.board_lock:
            for track in self.board.get_tracks():
                if track.net.name == net:
                    items.append(track)

            for via in self.board.get_vias():
                if via.net.name == net:
                    items.append(via)

            for pad in self.board.get_pads():
                if pad.net.name == net:
                    items.append(pad)

            self.board.clear_selection()
            self.board.add_to_selection(items)

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

