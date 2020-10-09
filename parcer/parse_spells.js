const fs = require("fs");
const http = require("http");
const parse = require("node-html-parser").parse;
// const spelllist = require('./spell_list.json');
const spellhtmls = require("./res/spell_htmls.json");
// const spelllistfailed = require('./res/spells_failed.json');
// const spellsPrefixes = require('./spells_prefixes.json');
// const spellsNumbers = require('./spells_numbers.json');
const TurndownService = require("turndown");
const turndownPluginGfm = require("turndown-plugin-gfm");
const turndownService = new TurndownService();
turndownService.use(turndownPluginGfm.gfm);

async function main() {
  try {
    fs.writeFileSync("parcer/res/spells.json", "[", "utf8");
    fs.writeFileSync("parcer/res/spells_failed.log", "", "utf8");
    let s = 0;
    let f = 0;
    spellhtmls.forEach((spellsHtml, index) => {
      if (![64, 379, 547, 565].includes(index)) {
        return;
      }
      logSuccess("Started", index);
      try {
        const shtml = spellsHtml.replace(/<a href ="PFS.aspx">/g, "");
        const spells = parseSpellPage(parse(shtml));
        spells.forEach((spell) => {
          if (!spell.name || 0 === spell.name.length) throw "Spell has no Name";
          if (!spell.lvl || 0 === spell.lvl.length) throw "Spell has no Level";

          if (!spell.description) throw "Spell has no Description";
          spell.url = `https://2e.aonprd.com/Spells.aspx?ID=${index}`;

          // console.log(spell);
          logSuccess(index, "ok", spell.name);
          if (index !== 0) {
            fs.appendFileSync("parcer/res/spells.json", ",", "utf8");
          }
          fs.appendFileSync(
            "parcer/res/spells.json",
            JSON.stringify(spell, null, 4),
            "utf8"
          );
          s++;
        });
      } catch (e) {
        logError(
          index,
          "Cant parse spell",
          spellsHtml
          // `https://2e.aonprd.com/Spells.aspx?ID=${index}`
        );
        logError("\t", e);
        fs.appendFileSync(
          "parcer/res/spells_failed.log",
          index + "\t" + e + "\n",
          "utf8"
        );
        f++;
      }
    });
    fs.appendFileSync("parcer/res/spells.json", "]", "utf8");
    logSuccess("Finished\n\n");
    logSuccess("Successed", s);
    logError("Failed", f);
  } catch (e) {
    logError(e);
  }
}
main();

function removeATag(data) {
  if (data.includes("<a")) {
    console.log(data);
    // const parsedData = parse('<p>' + data + '</p>');
    // return parsedData.text;
  }
  return data;
}

function changeName(name) {
  return name
    .replace("1", "I")
    .replace("2", "II")
    .replace("3", "III")
    .replace("4", "IV")
    .replace("5", "V")
    .replace("6", "VI")
    .replace("7", "VII")
    .replace("8", "VIII")
    .replace("9", "IX");
}

function parseSpellPage(rootVar) {
  let state = "NAME";
  const result = [];
  let span = [...rootVar.childNodes].filter((element) => {
    return !!element.innerHTML;
  });
  if (span[0].structure.startsWith("a")) {
    logError("Started with A");
  }
  span.forEach((rchild, index, elements) => {
    let spell = {};
    let description = "<div>";
    let traits = [];
    let statName;
    let stat;

    rchild.childNodes.forEach((child, index, elements) => {
      if (state != "DESCRIPTION" && child.structure == "hr") {
        state = "DESCRIPTION";
        return;
      }
      if (state == "DESCRIPTION" && child.structure == "hr") {
        state = "HEIGHTENED";
        return;
      }

      switch (state) {
        case "NAME":
          if (child.structure && child.structure.startsWith("h1")) {
            let spellLine = child.innerHTML;
            let nameIndex = spellLine.indexOf("<");
            spell.name = spellLine.substring(0, nameIndex);
            let lvlIndex = spellLine.indexOf(">");
            spell.lvl = spellLine.substring(
              lvlIndex + 1,
              spellLine.indexOf("<", lvlIndex)
            );
            state = "TRAITS";
          } else if (!child.structure && child.toString()) {
            spell.name = child.toString();
            state = "SPELLLVL";
          }
          break;
        case "SPELLLVL":
          if (
            child.structure &&
            child.structure.startsWith("span") &&
            child.getAttribute("style") == "float:right;"
          ) {
            spell.lvl = child.text;
            state = "TRAITS";
          }
          break;
        case "TRAITS":
          if (
            child.structure &&
            child.getAttribute("class") &&
            child.getAttribute("class").startsWith("trait")
          ) {
            traits.push(child.text);
          } else if (child.structure && child.structure.startsWith("br")) {
            spell.traits = traits;
            state = "SOURCE1";
          } else {
          }
          break;
        case "DESCRIPTION":
          description = description + removeATag(child.toString());
          break;
        case "SOURCE1":
          if (child.toString() == "<b>Source</b>") {
            state = "SOURCE2";
          }
          break;
        case "SOURCE2":
          if (child.text && child.text.trim()) {
            spell.source = child.text
              .substring(0, child.text.indexOf("pg."))
              .trim();
            state = "STATS";
          }
          break;
        case "STATS":
          if (child.structure && child.structure.startsWith("br")) {
            if (statName && stat) {
              spell[statName] = stat.trim().replace(/;/g,'');
            }
            stat = "";
            // state = "BR";
          } else if (child.structure && child.structure.startsWith("b")) {
            logSuccess(child.text);
            if (statName && stat) {
              spell[statName] = stat.trim().replace(/;/g,'');
            }
            statName = child.text.toLowerCase();
            stat = "";
          } else {
            stat = stat + child.text;
          }
          break;
        default:
          // console.log(child.toString());
          // console.log(child.structure);
          // console.log(child.text);
          throw `Undefined state ${state}.`;
      }
    });
    spell.name = spell.name.trim();
    spell.lvl = spell.lvl.trim();
    spell.description = `${description}</div>`;
    spell.description = turndownService.turndown(spell.description);
    result.push(spell);
  });
  return result;
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
