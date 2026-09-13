# 2one DLS MCP server — remote (Streamable HTTP).
# Build context MUST be the repo root, because the server shells out to the repo's
# own scripts (graph-decide, 2one check, what-uses) and reads manifest/graph/tokens/rules.
#   docker build -f mcp/Dockerfile -t 2one-mcp .
#   docker run -p 8787:8787 -e MCP_TOKEN=your-secret 2one-mcp
FROM node:20-slim
WORKDIR /app

# The whole repo is the data + logic source (.dockerignore trims the heavy bits).
COPY . /app

# Only the MCP server has npm dependencies; the wrapped scripts are pure Node builtins.
WORKDIR /app/mcp
RUN npm ci --omit=dev

ENV PORT=8787
EXPOSE 8787
CMD ["node", "server-http.mjs"]
