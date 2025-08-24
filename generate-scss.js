import fs from "fs";
import JSON5 from "json5";

const configPath = "css/scss/config.json";
const outputPath = "css/scss/_config.scss";

// read file
const config = JSON5.parse(fs.readFileSync(configPath, "utf8"));

/**
* converts a js value to scss (recursively for maps).
*/
const toScssValue = (val, indent = 1) => {
  if (typeof val === "object" && val !== null) {
    // nested map
    const inner = Object.entries(val)
      .map(([k, v]) => {
        return `${"    ".repeat(indent)}'${k}': ${toScssValue(v, indent + 1)}`;
      })
      .join(",\n");
    return `(\n${inner}\n${"    ".repeat(indent - 1)})`;
  } else if (typeof val === "string") {
    // --- scss special handling --- //
    // if string starts with "_config(…" or "$…" → SCSS code, do not stringify
    if (/^_config\(|^\$[a-zA-Z0-9_-]+/.test(val)) {
      return val;
    }

    // css-like values ​​(colors, px, %, hsl(), etc.)
    if (
      /^#/.test(val) ||
      /^[0-9.]+(px|em|rem|%)$/.test(val) ||
      /^[a-z-]+\([^)]+\)$/.test(val) || // hsl(), rgba(), …
      /^[0-9]+$/.test(val)
    ) {
      return val;
    }

    // default → string with quotes
    return `'${val}'`;
  } else {
    return val;
  }
};

/**
* distinguishes between map and variable
*/
const jsonToScss = (obj) => {
  let scss = "";
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null) {
      // map
      scss += `$${key}: ${toScssValue(value)};\n\n`;
    } else {
      // var
      scss += `$${key}: ${toScssValue(value)};\n\n`;
    }
  }
  return scss;
};

const scss = jsonToScss(config);

fs.writeFileSync(outputPath, scss);
console.log(`✅ ${outputPath} erfolgreich generiert!`);