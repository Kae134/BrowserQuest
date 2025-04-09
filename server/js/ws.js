const cls = require("./lib/class");
const url = require("url");
const http = require("http");
const WebSocket = require("ws");
const Utils = require("./utils");
const _ = require("underscore");
const log = require("log");

const WS = {};
const useBison = false;

module.exports = WS;

const Server = cls.Class.extend({
  init: function (port) {
    this.port = port;
    this._connections = {};
    this._counter = 0;

    const self = this;

    this._httpServer = http.createServer(function (req, res) {
      const path = url.parse(req.url).pathname;
      if (path === "/status" && self.status_callback) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.write(self.status_callback());
      } else {
        res.writeHead(404);
      }
      res.end();
    });

    this._httpServer.listen(this.port, () => {
      console.log(`Server is listening on port ${this.port}`);
    });

    this._wsServer = new WebSocket.Server({ server: this._httpServer });

    this._wsServer.on("connection", (ws, req) => {
      const id = self._createId();
      ws.remoteAddress = req.socket.remoteAddress;

      const connection = new WS.Connection(id, ws, self);
      if (self.connection_callback) self.connection_callback(connection);
      self.addConnection(connection);
    });
  },

  _createId: function () {
    return "5" + Utils.random(99) + "" + this._counter++;
  },

  onConnect: function (callback) {
    this.connection_callback = callback;
  },

  onError: function (callback) {
    this.error_callback = callback;
  },

  onRequestStatus: function (callback) {
    this.status_callback = callback;
  },

  broadcast: function (message) {
    this.forEachConnection(function (conn) {
      conn.send(message);
    });
  },

  forEachConnection: function (callback) {
    _.each(this._connections, callback);
  },

  addConnection: function (connection) {
    this._connections[connection.id] = connection;
  },

  removeConnection: function (id) {
    delete this._connections[id];
  },

  getConnection: function (id) {
    return this._connections[id];
  }
});

const Connection = cls.Class.extend({
  init: function (id, ws, server) {
    this.id = id;
    this._connection = ws;
    this._server = server;

    const self = this;

    ws.on("message", function (message) {
      if (self.listen_callback) {
        try {
            const data = JSON.parse(message);
          self.listen_callback(data);
        } catch (e) {
          if (e instanceof SyntaxError) {
            self.close("Invalid JSON received.");
          } else {
            throw e;
          }
        }
      }
    });

    ws.on("close", function () {
      if (self.close_callback) {
        self.close_callback();
      }
      self._server.removeConnection(self.id);
    });
  },

  onClose: function (callback) {
    this.close_callback = callback;
  },

  listen: function (callback) {
    this.listen_callback = callback;
  },

  send: function (message) {
    const data = JSON.stringify(message);
    this.sendUTF8(data);
  },

  sendUTF8: function (data) {
    this._connection.send(data);
  },

  close: function (logError) {
    console.log("Closing connection to " + this._connection.remoteAddress + ". Error: " + logError);
    this._connection.close();
  }
});

WS.MultiVersionWebsocketServer = Server;
WS.Connection = Connection;
