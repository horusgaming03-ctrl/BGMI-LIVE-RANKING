import { getEngineTheme, getEngineThemeIds, getEngineThemeMap } from "./generator";

export { getEngineTheme, getEngineThemeIds, getEngineThemeMap };

const COUNT = getEngineThemeIds().length;
export const ENGINE_THEME_COUNT = COUNT;

export default { getEngineTheme, getEngineThemeIds, getEngineThemeMap, ENGINE_THEME_COUNT };
