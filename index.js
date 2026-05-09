const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST", "DELETE"] },
});

let teams = [
  { id: 1, team: "ES", status: "alive", finishes: 4, points: 42 },
  { id: 2, team: "TR", status: "alive", finishes: 1, points: 28 },
  { id: 3, team: "ABZ", status: "alive", finishes: 0, points: 25 },
  { id: 4, team: "QS", status: "alive", finishes: 1, points: 23 },
  { id: 5, team: "GDR", status: "alive", finishes: 0, points: 20 },
  { id: 6, team: "JAPI", status: "alive", finishes: 0, points: 17 },
  { id: 7, team: "AX", status: "knocked", finishes: 3, points: 15 },
  { id: 8, team: "PNX", status: "alive", finishes: 0, points: 14 },
  { id: 9, team: "OOPS", status: "alive", finishes: 0, points: 10 },
  { id: 10, team: "SD", status: "alive", finishes: 1, points: 9 },
  { id: 11, team: "TD", status: "alive", finishes: 0, points: 8 },
  { id: 12, team: "FEZ", status: "alive", finishes: 1, points: 7 },
  { id: 13, team: "REDX", status: "alive", finishes: 0, points: 5 },
  { id: 14, team: "DCX", status: "alive", finishes: 0, points: 5 },
  { id: 15, team: "GDSX", status: "alive", finishes: 0, points: 5 },
  { id: 16, team: "VXT", status: "alive", finishes: 0, points: 2 },
];

const sortTeams = () =>
  [...teams].sort(
    (a, b) =>
      b.points - a.points ||
      b.finishes - a.finishes ||
      a.team.localeCompare(b.team)
  );

const broadcast = () => io.emit("teamsUpdated", sortTeams());

app.get("/teams", (req, res) => {
  res.json(sortTeams());
});

app.post("/teams", (req, res) => {
  const team = String(req.body.team || "").toUpperCase().trim();

  if (!team) {
    return res.status(400).json({ message: "team required" });
  }

  const item = {
    id: Date.now(),
    team,
    status: req.body.status || "alive",
    finishes: Number(req.body.finishes || 0),
    points: Number(req.body.points || 0),
  };

  teams.push(item);
  broadcast();
  res.status(201).json(item);
});

app.post("/teams/:id", (req, res) => {
  const id = Number(req.params.id);
  const idx = teams.findIndex((t) => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ message: "not found" });
  }

  teams[idx] = {
    ...teams[idx],
    team: String(req.body.team || teams[idx].team).toUpperCase(),
    status: req.body.status || teams[idx].status,
    finishes: Number(req.body.finishes ?? teams[idx].finishes),
    points: Number(req.body.points ?? teams[idx].points),
  };

  broadcast();
  res.json(teams[idx]);
});

app.delete("/teams/:id", (req, res) => {
  const id = Number(req.params.id);
  teams = teams.filter((t) => t.id !== id);
  broadcast();
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  socket.emit("teamsUpdated", sortTeams());

  socket.on("requestTeams", () => {
    socket.emit("teamsUpdated", sortTeams());
  });
});

server.listen(3001, () => {
  console.log("Server running on port 3001");
});