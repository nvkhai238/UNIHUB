const http = require('http');
const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'success', message: 'Mock Payment OK' }));
});

server.listen(PORT, () => {
  console.log(`Mock payment running on port ${PORT}`);
});