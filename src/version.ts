// The name and version this server introduces itself with over MCP, and the
// version a reported failure is stamped with.
//
// They live in their own module because the reporter needs the version to name
// a release and the server needs the reporter: with the constants left in
// `server.ts` those two would import each other in a circle.
export const SERVER_NAME = "doc-cheap-mcp";
export const SERVER_VERSION = "0.3.7";
