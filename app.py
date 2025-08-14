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
        return jsonify({"error": str(e)}), 500

@app.route("/select_net", methods=["PUT"])
def select_net():
    try:
        net = request.json.get("net")
        if not net:
            return jsonify({"error": "Missing 'net' parameter"}), 400
        result = ctx.select_net(net)
        return jsonify({"result": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)
