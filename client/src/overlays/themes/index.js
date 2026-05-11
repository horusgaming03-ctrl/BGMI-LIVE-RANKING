import { esports } from "./esports";
import { premiumGold } from "./premiumGold";
import { neon } from "./neon";
import { cyberpunk } from "./cyberpunk";
import { minimal } from "./minimal";
import { cleanBroadcast } from "./cleanBroadcast";
import { pubgTournament } from "./pubgTournament";
import { futuristic } from "./futuristic";
import { darkGlass } from "./darkGlass";
import { rgbAnimated } from "./rgbAnimated";
import { compactPro } from "./compactPro";
import { streamerStyle } from "./streamerStyle";

const themes = {
  esports,
  premiumGold,
  neon,
  cyberpunk,
  minimal,
  cleanBroadcast,
  pubgTournament,
  futuristic,
  darkGlass,
  rgbAnimated,
  compactPro,
  streamerStyle,
};

export const getTheme = (name) => themes[name] || themes.esports;
export const getThemeNames = () => Object.keys(themes);
export default themes;
