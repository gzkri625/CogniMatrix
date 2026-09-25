import { onRequestPost as __api_odeme_baslat_ts_onRequestPost } from "/home/user/CogniMatrix/functions/api/odeme/baslat.ts"
import { onRequestPost as __api_odeme_dogrula_ts_onRequestPost } from "/home/user/CogniMatrix/functions/api/odeme/dogrula.ts"
import { onRequestGet as __api_odeme_durum_ts_onRequestGet } from "/home/user/CogniMatrix/functions/api/odeme/durum.ts"
import { onRequestPost as __api_odeme_sonuc_ts_onRequestPost } from "/home/user/CogniMatrix/functions/api/odeme/sonuc.ts"

export const routes = [
    {
      routePath: "/api/odeme/baslat",
      mountPath: "/api/odeme",
      method: "POST",
      middlewares: [],
      modules: [__api_odeme_baslat_ts_onRequestPost],
    },
  {
      routePath: "/api/odeme/dogrula",
      mountPath: "/api/odeme",
      method: "POST",
      middlewares: [],
      modules: [__api_odeme_dogrula_ts_onRequestPost],
    },
  {
      routePath: "/api/odeme/durum",
      mountPath: "/api/odeme",
      method: "GET",
      middlewares: [],
      modules: [__api_odeme_durum_ts_onRequestGet],
    },
  {
      routePath: "/api/odeme/sonuc",
      mountPath: "/api/odeme",
      method: "POST",
      middlewares: [],
      modules: [__api_odeme_sonuc_ts_onRequestPost],
    },
  ]