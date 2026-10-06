'use strict';
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const store = require('./seasonStore');

const HEADER_ALIASES = {
  realName: ['姓名', '学生姓名', '真实姓名', 'name', 'realname'],
  studentId: ['学号', '学生学号', 'studentid', 'studentno', 'studentnumber'],
  admissionYear: ['入学年份', '入学年', '年级', '级别', 'admissionyear', 'year'],
  college: ['学院', '院系', '所属学院', 'college', 'department']
};
const normalizeHeader = value => String(value ?? '').trim().toLowerCase().replace(/[\s_\-（）()]/g, '');
function cellText(value) {
  if (value && typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map(x => x.text || '').join('').trim();
    if (value.result !== undefined) return String(value.result ?? '').trim();
    if (value.text !== undefined) return String(value.text ?? '').trim();
  }
  return String(value ?? '').trim();
}
function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (quoted) store.fail('CSV 存在未闭合的引号', 'ROSTER_PARSE_FAILED', 400);
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function headerMap(row) {
  const normalized = row.map(normalizeHeader), result = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    result[field] = normalized.findIndex(value => aliases.includes(value));
    if (result[field] < 0) store.fail(`花名册缺少“${aliases[0]}”列`, 'ROSTER_HEADER_INVALID', 400);
  }
  return result;
}
function normalizeRows(rows, seasonId) {
  const first = rows.findIndex(row => row.some(value => cellText(value)));
  if (first < 0) store.fail('花名册为空', 'ROSTER_EMPTY', 400);
  const columns = headerMap(rows[first]);
  const expectedYear = /^([0-9]{4})-/.exec(seasonId)?.[1] || '';
  const records = [], seen = new Set();
  for (let i = first + 1; i < rows.length; i++) {
    const source = rows[i];
    if (!source.some(value => cellText(value))) continue;
    const record = {
      realName: cellText(source[columns.realName]),
      studentId: cellText(source[columns.studentId]),
      admissionYear: cellText(source[columns.admissionYear]),
      college: cellText(source[columns.college])
    };
    if (Object.values(record).some(value => !value)) store.fail(`第 ${i + 1} 行存在空白必填项`, 'ROSTER_ROW_INVALID', 400);
    if (!/^[0-9A-Za-z-]{4,32}$/.test(record.studentId)) store.fail(`第 ${i + 1} 行学号格式无效`, 'ROSTER_ROW_INVALID', 400);
    if (!/^[0-9]{4}$/.test(record.admissionYear)) store.fail(`第 ${i + 1} 行入学年份应为四位数字`, 'ROSTER_ROW_INVALID', 400);
    if (expectedYear && record.admissionYear !== expectedYear) store.fail(`第 ${i + 1} 行入学年份与活动期 ${seasonId} 不符`, 'ROSTER_YEAR_MISMATCH', 400);
    const key = record.studentId.toUpperCase();
    if (seen.has(key)) store.fail(`学号 ${record.studentId} 在花名册中重复`, 'ROSTER_DUPLICATE_STUDENT_ID', 400);
    seen.add(key); records.push(record);
    if (records.length > 10000) store.fail('花名册最多包含 10000 人', 'ROSTER_TOO_LARGE', 413);
  }
  if (!records.length) store.fail('花名册没有学生记录', 'ROSTER_EMPTY', 400);
  return records;
}
async function parse(buffer, originalName, seasonId) {
  const ext = String(originalName || '').toLowerCase().split('.').pop();
  let rows;
  if (ext === 'csv') rows = parseCsv(buffer.toString('utf8').replace(/^\uFEFF/, ''));
  else if (ext === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(buffer); } catch { store.fail('无法解析 Excel 文件', 'ROSTER_PARSE_FAILED', 400); }
    const sheet = workbook.worksheets[0];
    if (!sheet) store.fail('Excel 文件没有工作表', 'ROSTER_EMPTY', 400);
    rows = [];
    sheet.eachRow({ includeEmpty: false }, row => { rows.push(row.values.slice(1)); });
  } else store.fail('仅支持 .xlsx 或 UTF-8 编码的 .csv 花名册', 'ROSTER_FILE_TYPE_INVALID', 415);
  const records = normalizeRows(rows, seasonId);
  return {
    schemaVersion: 1,
    seasonId,
    importedAt: new Date().toISOString(),
    sourceName: String(originalName || '').slice(0, 160),
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    count: records.length,
    records
  };
}
function summary(roster) {
  if (!roster) return null;
  const colleges = Object.entries(roster.records.reduce((out, row) => { out[row.college] = (out[row.college] || 0) + 1; return out; }, {})).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
  return { seasonId: roster.seasonId, importedAt: roster.importedAt, sourceName: roster.sourceName, sha256: roster.sha256, count: roster.count, colleges };
}
module.exports = { parseCsv, normalizeRows, parse, summary };
