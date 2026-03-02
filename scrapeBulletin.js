const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs-extra");

const URL = "https://bulletin.du.edu/undergraduate/coursedescriptions/comp/";

async function scrapeBulletin() {
  const { data } = await axios.get(URL);
  const $ = cheerio.load(data);

  await fs.ensureDir("results");

  const courses = [];

  $(".courseblock").each((_, el) => {
    const titleBlock = $(el).find(".courseblocktitle");
    const fullTitle = titleBlock.text().trim();

    const match = fullTitle.match(/(COMP\s\d{4})\s+(.*)\s+\(/);

    if (!match) return;

    const courseCode = match[1];
    const courseTitle = match[2];

    const courseNumber = parseInt(courseCode.split(" ")[1], 10);
    if (courseNumber < 3000) return;

    const fullText = $(el).text().toLowerCase();
    if (fullText.includes("prerequisite")) return;

    courses.push({
      course: courseCode.replace(" ", "-"),
      title: courseTitle
    });
  });

  await fs.writeJson("results/bulletin.json", { courses }, { spaces: 2 });
  console.log(` bulletin.json created with ${courses.length} courses`);
}

scrapeBulletin().catch(console.error);