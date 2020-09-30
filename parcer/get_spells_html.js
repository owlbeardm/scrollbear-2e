const fs = require("fs");
const https = require("https");
const parse = require("node-html-parser").parse;
// const spelllist = require('./res/spell_list.json');
const TurndownService = require("turndown");
const turndownPluginGfm = require("turndown-plugin-gfm");
const turndownService = new TurndownService();
turndownService.use(turndownPluginGfm.gfm);

async function loadSpells() {
  try {
    fs.writeFileSync("parcer/res/spell_htmls.json", "[", "utf8");
    for (let i = 1; i < 870; i++) {
      const spelllink = `https://2e.aonprd.com/Spells.aspx?ID=${i}`;
      try {
        const spell = await getSpellHtml(spelllink);
        logSuccess(i, "ok", spelllink);
        if (i !== 1) {
          fs.appendFileSync("parcer/res/spell_htmls.json", ",", "utf8");
        }
        fs.appendFileSync(
          "parcer/res/spell_htmls.json",
          JSON.stringify(spell, null, 4),
          "utf8"
        );
      } catch (e) {
        logError(i, "Cant parse spell", spelllink);
        logError("\t", e);
      }
    }
    fs.appendFileSync("parcer/res/spell_htmls.json", "]", "utf8");
    logSuccess("Finished\n\n");
  } catch (e) {
    logError(e);
  }
}
loadSpells();

function getSpellHtml(url) {
  return new Promise(function (resolve, reject) {
    https
      .get(url, (res) => {
        const { statusCode } = res;
        const contentType = res.headers["content-type"];
        let error;
        if (statusCode !== 200) {
          error = new Error("Request Failed.\n" + `Status Code: ${statusCode}`);
        }
        if (error) {
          // console.error(error.message);
          reject(error);
          res.resume();
          return;
        }

        res.setEncoding("utf8");
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          try {
            const start = rawData.indexOf("ctl00_MainContent_DetailedOutput");
            const strs = rawData.substring(start+34);
            const end = strs.indexOf("</div>");
            const spellspn = strs.substring(0, end).trim();
            const spell = `<div>${spellspn.substring(0, spellspn.length-7)}</div>`;
            
            // logSuccess(rawData);
            const rootVar = parse(spell, {
              lowerCaseTagName: true, // convert tag name to lower case (hurt performance heavily)
              script: true, // retrieve content in <script> (hurt performance slightly)
              style: true, // retrieve content in <style> (hurt performance slightly)
              pre: true, // retrieve content in <pre> (hurt performance slightly)
              comment: true, // retrieve comments (hurt performance slightly)
            });
            // logSuccess(rawData);
            resolve(rootVar.innerHTML);
          } catch (e) {
            // console.error(e.message);
            reject(e);
          }
        });
      })
      .on("error", (e) => {
        // console.error(`Got error: ${e.message}`);
        reject(e);
      });
  });
}

function logError(...arguments) {
  if (typeof console !== "undefined") {
    arguments.unshift("\x1b[31m");
    arguments.push("\x1b[0m");
    console.log.apply(console, arguments);
  }
}

function logSuccess(...arguments) {
  if (typeof console !== "undefined") {
    arguments.unshift("\x1b[32m");
    arguments.push("\x1b[0m");
    console.log.apply(console, arguments);
  }
}
