import { connectSocket, getApiBase } from "../apiOrigin";

const socket = connectSocket();

export default socket;
export const API = getApiBase();
export { getApiBase, apiUrl } from "../apiOrigin";
