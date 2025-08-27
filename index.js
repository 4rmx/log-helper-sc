const fs = require('fs');
const { differenceInMinutes, format } = require('date-fns');
const raw = fs.readFileSync('input.log', { encoding: 'utf-8' });
const { stringify } = require('csv-stringify');
const ExcelJS = require('exceljs');
const path = require('path');

const logs = raw.split('\n');

const gunPattern = /gun\d.*send2m4(| )start/gi;
const arr = [],
  arrCount = [];
let count = 1;
for (let i = 0; i < logs.length; i++) {
  const line = logs[i];
  if (gunPattern.test(line)) {
    const gunNo = extractGunNo(line);
    if (createGunRegExp(gunNo, 'start').test(line)) {
      const time = extractTime(line);

      // console.log(line);
      // console.log(`${i}, ${time}, ${gunNo}`);
      const { line: stopLine, mdls } = getEndOfCharge(i, gunNo);
      if (stopLine) {
        const stopAt = extractTime(stopLine);

        arr.push({
          count: count++,
          gun: gunNo,
          startAt: format(time, 'dd-MM-yyyy HH:mm:ss z'),
          stopAt: format(stopAt, 'dd-MM-yyyy HH:mm:ss z'),
          duration: differenceInMinutes(stopAt, time),
          msg: stopLine,
          // mdls: mdls,
        });
        arrCount.push(mdls);
      }
    }
  }
}

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('charge');

function createHeaderFromObj(data) {
  const headers = Object.keys(data[0]);

  return headers.map((key) => ({
    header: key.charAt(0).toUpperCase() + key.slice(1),
    key: key,
    width: 10,
  }));
}
const columns = createHeaderFromObj(arr);

worksheet.columns = columns;

worksheet.addRows(arr);

const filePath = path.join(__dirname, 'output.xlsx');

for (let i = 0; i < arrCount.length; i++) {
  const el = arrCount[i];
  if (el.length) {
    const worksheet2 = workbook.addWorksheet('charge-count-' + i);
    const columns2 = createHeaderFromObj(el);
    worksheet2.columns = columns2;
    worksheet2.addRows(el);
  } else {
    workbook.addWorksheet('charge-count-' + i);
    // const columns2 = createHeaderFromObj(el);
    // worksheet2.columns = columns2;
    // worksheet2.addRows(el);
  }
}

workbook.xlsx
  .writeFile(filePath)
  .then(() => {
    console.log(`Excel file saved to ${filePath}`);
  })
  .catch((error) => {
    console.error('Error saving Excel file:', error);
  });

// stringify(arr, { header: true }, (err, csvString) => {
//   if (err) {
//     console.error(err);
//     return;
//   }
//   fs.writeFileSync('output.csv', csvString);
// });

// for (let i = 0; i < arrCount.length; i++) {
//   const el = arrCount[i];
//   stringify(el, { header: true }, (err, csvString) => {
//     if (err) {
//       console.error(err);
//       return;
//     }
//     fs.writeFileSync(`outputCount-${i}.csv`, csvString);
//   });
// }

// console.log(console.table(arr));
// console.table(arr[0].mdls);
// console.table(mdls);

function getEndOfCharge(startLn, gunNo) {
  const mdls = [];

  for (let i = startLn; i < logs.length; i++) {
    const line = logs[i];

    if (/connId":255/gi.test(line)) {
      const mdl = extractMdl(line);
      if (mdl) {
        const timestamp = extractTime(line);
        const mdlMaping = [];
        for (let j = 1; j < mdl.length + 1; j++) {
          const el = mdl[j - 1];
          mdlMaping.push({
            // [`${j}`]: el.id_mdl_id,
            [`${j}_inputVol`]: el.id_mdl_inputvol,
            [`${j}_reqVol`]: el.id_mdl_reqvol,
            [`${j}_realVol`]: el.id_mdl_realvol,
            [`${j}_reqCur`]: el.id_mdl_reqcur,
            [`${j}_realCur`]: el.id_mdl_realvol,
            [`${j}_status`]: el.id_mdl_status,
            [`${j}_sts`]: el.id_mdl_sts,
            [`${j}_mode`]: el.id_mdl_mode,
            [`${j}_temp`]: el.id_mdl_temp,
            [`${j}_time`]: el.id_mdl_time,
          });
        }

        // const mdlMaping = mdl.map((x) => {
        //   return {
        //     timestamp,
        //     id: x.id_mdl_id,
        //     inputVol: x.id_mdl_inputvol,
        //     reqVol: x.id_mdl_reqvol,
        //     realVol: x.id_mdl_realvol,
        //     reqCur: x.id_mdl_reqcur,
        //     realCur: x.id_mdl_realcur,
        //     status: x.id_mdl_status,
        //     sts: x.id_mdl_sts,
        //     mode: x.id_mdl_mode,
        //     time: x.id_mdl_time,
        //   };
        // });

        const rdMdl = mdlMaping.reduce((acc, currentObject) => {
          return { ...acc, ...currentObject };
        }, {});
        // mdls.push(rdMdl);

        // console.table({rdMdl});
        mdls.push({ timestamp, ...rdMdl });
      }
    }

    if (createGunRegExp(gunNo, 'stop').test(line)) {
      // console.log(line);
      // fs.writeFileSync('output.json', JSON.stringify(mdls));
      return { line, mdls };
    }
  }
  return { line: undefined, mdls: undefined };
}
// focusLogRange(new Date('2025-07-31T11:08:10.936'));

function focusLogRange(focusTime) {
  let isFocus = false;
  const mdls = [];
  for (let i = 0; i < logs.length; i++) {
    const line = logs[i];

    if (extractTime(line) < focusTime) {
      continue;
    }

    if (createGunRegExp(1, 'start').test(line)) {
      isFocus = true;
      // console.log(extractTime(line));
      console.log(line);
      continue;
    }

    if (/connId":255/gi.test(line) && isFocus) {
      // console.log(line);
      const mdl = extractMdl(line);
      if (mdl) {
        console.table(mdl);
        mdls.push(mdl);
      }
      // break;
    }

    if (createGunRegExp(1, 'stop').test(line)) {
      isFocus = false;
      console.log(line);
      console.log(mdls.length);
      break;
    }
  }
}

function extractGunNo(line) {
  const regex = /Gun\d( |)Send2M4/i;
  const match = line.match(regex);
  if (match) {
    const match2 = match[0].split(' ')[0].match(/\d+/);

    if (match2) {
      return parseInt(match2[0], 10);
    }
    return null;
  }
}

function extractTime(line) {
  return new Date(line.split(' ')[0].replace('+00', ''));
}

/**
 *  GunX Send2M4 Start CMD
 *  GUNX Send2M4 Stop CMD
 *
 * @param {1|2} gunNo
 * @param {'start'|'stop'} cmd
 */
function createGunRegExp(gunNo, cmd) {
  return new RegExp(`gun${gunNo}.*send2m4( |)${cmd}`, 'gi');
}

function extractMdl(line) {
  // Find the index of the JSON object's starting curly brace
  const jsonStartIndex = line.indexOf('{');

  if (jsonStartIndex === -1) {
    console.error('JSON object not found in the string.');
    return null;
  }

  // Extract the substring containing only the JSON
  const jsonString = line.substring(jsonStartIndex);

  try {
    // Parse the JSON string into a JavaScript object
    const data = JSON.parse(jsonString);

    // Return the 'mdl' object nested within 'body'
    if (data.body.mdl?.[0]) {
      return data.body.mdl;
    } else {
      return undefined;
    }
  } catch (e) {
    console.error('Failed to parse JSON:', e);
    return null;
  }
}
