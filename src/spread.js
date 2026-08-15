// Objekt-Zusammenfuehrung (aus dem Grossblock herausgeloest, v3.78.0).
//
// Diese Helfer stammen aus der esbuild-Ausgabe, mit der index.html
// urspruenglich erzeugt wurde — sie sind das Gegenstueck zu `{...a, ...b}`.
// Sie lagen mitten im Tonblock und wanderten beim Herausloesen mit; der
// Spielcode brauchte sie aber an ueber vierzig Stellen und stand ploetzlich
// ohne da ("__spreadValues is not defined", weisser Bildschirm).
//
// Als eigenes Modul statt doppelt definiert: eine Quelle, kein Auseinander-
// laufen. Ersetzen liesse sich das durch echte Spread-Syntax — aber das waere
// eine Aenderung an ueber vierzig Stellen ohne jeden Nutzen.
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

export { __defProp, __defProps, __getOwnPropDescs, __getOwnPropSymbols,
         __hasOwnProp, __propIsEnum, __defNormalProp, __spreadValues, __spreadProps };
