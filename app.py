from flask import Flask, render_template
from test import context
from flask import jsonify
from flask import request

app = Flask(__name__)

ctx = context()

@app.route("/net_lengths", methods=["GET"])
def get_lengths():
    try:
        filter_param = request.args.get("filter")
        data = ctx.net_lengths(filter_param)
        return jsonify(data), 200
    except Exception as e:
        app.logger.error({"Error in /net_lengths": e})
        return jsonify({"error": str(e)}), 500

@app.route("/get_nets", methods=["GET"])
def get_nets():
    try:
        nets = ctx.get_nets()
        return jsonify(nets), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/selected_nets", methods=["GET"])
def get_selected_net():
    try:
        selected_nets = ctx.get_selected_nets()
        return jsonify({"selected_nets": selected_nets}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/selected_nets", methods=["PUT"])
def select_net():
    try:
        nets = request.json.get("nets")
        result = ctx.select_nets(nets)
        return jsonify({"result": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)
