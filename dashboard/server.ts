import index from "./index.html";

const port = process.env.PORT ? parseInt(process.env.PORT) : 3201;

console.log(`Starting dashboard on port ${port}...`);

Bun.serve({
  port,
  routes: {
    "/": index,
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Dashboard running at http://localhost:${port}`);
