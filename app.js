/**
 * CSGO Death Mapper.
 * CMD ARGS -- demo file path, map t side?, playername
 * e.g. app.js path.dem true zywoo --- would map t side deaths of demo
 * Matthew Kleitz, 2021
 */

let fs = require("fs");
let demofile = require("demofile");
let args = process.argv.slice(2);
const dmpath = args[0];
const tside = args[1] == "true";
const pname = args[2];

const { createCanvas, loadImage } = require("canvas");

// setup canvas context
const canvas = createCanvas(2000, 2600);
const ctx = canvas.getContext("2d");

let lastTScore = 0;
let lastCTScore = 0;
let radarimg;

// load overpass radar file.
loadImage("./ovpr.png").then(image => {
  radarimg = image;
  drawRadar();
});

let demoFile;
// read demo file
fs.readFile(dmpath, (err, buffer) => {
  demoFile = new demofile.DemoFile();

  // setup event handlers
  demoFile.gameEvents.on("player_death", onPlayerDeath);
  demoFile.gameEvents.on("round_end", onRoundEnd);

  demoFile.parse(buffer);
});


function drawRadar() {
  ctx.drawImage(radarimg, 0, 0);
}

/**
 * Converts game coordinate to radar coordinates.
 * Just for overpass right now.
 */
function transpos(p) {
  let a = p.x;
  let b = p.y;
  return { x:((a + 4000)/2), y:(2640 - (b + 4000)/2.25) }
}

/**
 * Returns true if a team's score goes from 15 to 0. Indicates a win on an esea server.
 */
function teamWon(lastScore, newScore) {
  return lastScore == 15 && newScore == 0;
}

/**
 * Draws a dot at given position and color
 * @param {Vector} pos 
 * @param {Color} col 
 */
function drawDot(pos, col) {
  ctx.fillStyle = col;
  ctx.fillRect(pos.x, pos.y, 25, 25);
}

/**
 * Is called when a player dies. Create a map of the death for the given player to analyze.
 */
function onPlayerDeath(e) {
  const victim = demoFile.entities.getByUserId(e.userid);
  const attacker = demoFile.entities.getByUserId(e.attacker);
  // check which side the player is on... likely better way of checking this
  let ist = victim.modelName.indexOf("ctm_") == -1;

  if (victim.name == pname && (ist != !tside)) {
    
    let vpos = transpos(victim.position);
    // draw dot for victim. Orange if T side.
    drawDot(vpos, ist ? "orange" : "blue");
    
    let apos = transpos(attacker.position);
    // draw dot for attacker. Assume opposite team.
    drawDot(apos, ist ? "blue" : "orange");
    

    // draw line from attacker to victim
    ctx.beginPath();
    ctx.moveTo(vpos.x, vpos.y);
    ctx.lineTo(apos.x, apos.y);
    ctx.stroke(); 
  }
}

/**
 * Is called when a round ends. Checks to see if game is over. If game is over, save the death map to a file.
 * @param {} e 
 */
function onRoundEnd(e) {
  // fetch the teams from the demo info
  const teams = demoFile.teams;
  const terrorists = teams[2];
  const cts = teams[3];

  // this is a for warmup restarts in esea. e.g. the score goes from 0,0 to 0,0. If so, redraw the radar
  // to hide warmup kills
  if (lastTScore == terrorists.score && lastCTScore == cts.score) {
    drawRadar();
  }

  // check if either team has one
  if (teamWon(lastTScore, terrorists.score) || teamWon(lastCTScore, cts.score)) {
    // save the canvas drawing to a png
    const out = fs.createWriteStream(__dirname + '/test.png');
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () =>  console.log("Death map saved."));
  }

  // log the score of this current round.
  lastTScore = terrorists.score;
  lastCTScore = cts.score;
}