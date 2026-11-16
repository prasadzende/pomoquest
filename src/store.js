// Tiny JSON-file store kept in the OS user-data folder.
const fs = require('fs');
const path = require('path');

class JsonStore {
  constructor(file, defaults) {
    this.file = file;
    this.defaults = defaults;
    this.data = { ...defaults };
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        this.data = { ...defaults, ...raw };
      }
    } catch (err) {
      console.error('Could not read', file, err);
    }
  }
  get() {
    return JSON.parse(JSON.stringify(this.data));
  }
  set(patch) {
    this.data = { ...this.data, ...patch };
    this.save();
    return this.get();
  }
  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('Could not save', this.file, err);
    }
  }
}

module.exports = { JsonStore };
