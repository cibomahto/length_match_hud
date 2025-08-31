from turtle import delay
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

    def get_thru_via_thickness(self):
        # Note: we get a different result from KiCad because we include the top and bottom copper thickness. It's an approximation either way.
        thickness = 0

        with self.board_lock:
            stackup = self.board.get_stackup()
            for layer in stackup.layers:
                if layer.type == 1 or layer.type == 2:
                    #print(f"Layer {layer.layer} thickness: {util.units.to_mm(layer.thickness)} mm")

                    thickness += util.units.to_mm(layer.thickness)


        return thickness

    def net_lengths(self, filter):
        nets = {}
        
        with self.board_lock:
            for net in self.board.get_nets():
                if net.name.find(filter) != -1:
                    nets[net.name] = {
                        'layer_lengths': {},
                        'vias': 0
                    }

            # Sum lengths of all tracks, in all layers. Note that this includes any stubs
            # TODO: Sum lengths separately for each layer
            for track in self.board.get_tracks():
                if track.net.name in nets:
                    net = nets[track.net.name]
                    track_length_mm = util.units.to_mm(track.length())
                    net['layer_lengths'][track.layer] = net['layer_lengths'].get(track.layer, 0) + track_length_mm

            for via in self.board.get_vias():
                if via.net.name in nets:
                    net = nets[via.net.name]

                    net['vias'] += 1

        return nets
    
    def get_selected_nets(self):
        # Just return the first selected net
        with self.board_lock:
            nets = []
            for selected in self.board.get_selection():
                if hasattr(selected,'net'):
                    if not selected.net.name in nets:
                        nets.append(selected.net.name)

        return nets

    def select_nets(self, nets):
        items = []

        with self.board_lock:
            for track in self.board.get_tracks():
                if track.net.name in nets:
                    items.append(track)

            for via in self.board.get_vias():
                if via.net.name in nets:
                    items.append(via)

            for pad in self.board.get_pads():
                if pad.net.name in nets:
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

