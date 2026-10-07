const TYPES = [
  "INT",
  "BIGINT",
  "SMALLINT",
  "VARCHAR(255)",
  "TEXT",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "DECIMAL(10,2)",
  "FLOAT",
  "JSON",
  "UUID",
];
const ACTIONS = ["NO ACTION", "CASCADE", "SET NULL", "RESTRICT"];
const PG_TYPES = { DATETIME: "TIMESTAMP", JSON: "JSONB" };
const MY_TYPES = { UUID: "CHAR(36)" };

const state = {
  dialect: "mysql",
  db: "ma_base",
  createDb: true,
  user: { name: "", host: "localhost", password: "", create: true },
  tables: [],
};

let sql = "";
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const options = (list, sel) =>
  list
    .map((o) => `<option${o === sel ? " selected" : ""}>${esc(o)}</option>`)
    .join("");

const newCol = (name = "", type = "VARCHAR(255)") => ({
  name,
  type,
  pk: false,
  nn: false,
  uq: false,
  ai: false,
});

function generate() {
  const pg = state.dialect === "postgres";
  const q = (n) =>
    pg
      ? `"${String(n).replace(/"/g, "")}"`
      : `\`${String(n).replace(/`/g, "")}\``;
  const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const out = [];
  const db = state.db.trim();
  if (db) {
    if (state.createDb)
      out.push(
        pg
          ? `CREATE DATABASE ${q(db)};`
          : `CREATE DATABASE IF NOT EXISTS ${q(db)};`,
      );
    out.push(pg ? `\\c ${db}` : `USE ${q(db)};`);
  }
  const tables = state.tables.filter((t) => t.name.trim());
  for (const t of tables) {
    const cols = t.cols.filter((c) => c.name.trim());
    const lines = cols.map((c) => {
      let type = (pg ? PG_TYPES : MY_TYPES)[c.type] || c.type;
      let extra = "";
      if (c.ai) {
        if (pg)
          type =
            type === "BIGINT"
              ? "BIGSERIAL"
              : type === "SMALLINT"
                ? "SMALLSERIAL"
                : "SERIAL";
        else extra = " AUTO_INCREMENT";
      }
      return `  ${q(c.name)} ${type}${c.nn || c.pk ? " NOT NULL" : ""}${extra}${c.uq && !c.pk ? " UNIQUE" : ""}`;
    });
    const pks = cols.filter((c) => c.pk).map((c) => q(c.name));
    if (pks.length) lines.push(`  PRIMARY KEY (${pks.join(", ")})`);
    out.push(`CREATE TABLE ${q(t.name)} (\n${lines.join(",\n")}\n);`);
  }

  for (const t of tables) {
    for (const f of t.fks) {
      if (!f.col || !f.refTable || !f.refCol) continue;
      out.push(
        `ALTER TABLE ${q(t.name)} ADD CONSTRAINT ${q(`fk_${t.name}_${f.col}`)}\n  FOREIGN KEY (${q(f.col)}) REFERENCES ${q(f.refTable)} (${q(f.refCol)}) ON DELETE ${f.onDelete};`,
      );
    }
  }

  const u = state.user;
  if (u.name.trim()) {
    const host = lit(u.host || "localhost");
    if (pg) {
      if (u.create)
        out.push(`CREATE USER ${q(u.name)} WITH PASSWORD ${lit(u.password)};`);
      if (db)
        out.push(`GRANT ALL PRIVILEGES ON DATABASE ${q(db)} TO ${q(u.name)};`);
      out.push(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${q(u.name)};`,
      );
    } else {
      if (u.create)
        out.push(
          `CREATE USER IF NOT EXISTS ${lit(u.name)}@${host} IDENTIFIED BY ${lit(u.password)};`,
        );
      out.push(
        `GRANT ALL PRIVILEGES ON ${db ? q(db) : "*"}.* TO ${lit(u.name)}@${host};\nFLUSH PRIVILEGES;`,
      );
    }
  }
  sql = out.join("\n\n");
  const code = $("[data-sql]");
  code.textContent = sql;
  document.dispatchEvent(new CustomEvent("sorastool:content-updated"));
}

function render() {
  const names = state.tables.map((t) => t.name).filter(Boolean);
  $("[data-tables]").innerHTML = state.tables
    .map((t, ti) => {
      const colNames = t.cols.map((c) => c.name).filter(Boolean);
      const cols = t.cols
        .map(
          (c, ci) => `<div class="sb-row" data-t="${ti}" data-c="${ci}">
            <input data-k="name" value="${esc(c.name)}" placeholder="colonne">
            <select data-k="type">${options(TYPES, c.type)}</select>
            <label title="Clé primaire (plusieurs = composite)"><input type="checkbox" data-k="pk"${c.pk ? " checked" : ""}> PK</label>
            <label title="NOT NULL"><input type="checkbox" data-k="nn"${c.nn ? " checked" : ""}> NN</label>
            <label title="Clé unique"><input type="checkbox" data-k="uq"${c.uq ? " checked" : ""}> UQ</label>
            <label title="Auto-incrément"><input type="checkbox" data-k="ai"${c.ai ? " checked" : ""}> AI</label>
            <button type="button" data-del-col data-label="Supprimer la colonne"></button>
          </div>`,
        )
        .join("");
      const fks = t.fks
        .map((f, fi) => {
          const refCols = (
            state.tables.find((x) => x.name === f.refTable)?.cols || []
          )
            .map((c) => c.name)
            .filter(Boolean);
          return `<div class="sb-row" data-t="${ti}" data-f="${fi}">
            <span>FK</span>
            <select data-k="col"><option value=""></option>${options(colNames, f.col)}</select>
            <span>→</span>
            <select data-k="refTable"><option value=""></option>${options(names, f.refTable)}</select>
            <select data-k="refCol"><option value=""></option>${options(refCols, f.refCol)}</select>
            <select data-k="onDelete" title="ON DELETE">${options(ACTIONS, f.onDelete)}</select>
            <button type="button" data-del-fk data-label="Supprimer la clé étrangère"></button>
          </div>`;
        })
        .join("");
      return `<article class="sb-table" data-t="${ti}">
        <header><input data-k="tname" value="${esc(t.name)}" placeholder="nom_table">
          <button type="button" data-add-col data-label="Ajouter une clé" title="Ajouter une clé">Clé</button>
          <button type="button" data-add-fk data-label="Ajouter une clé étrangère" title="Ajouter une clé étrangère">Clé étrangère</button>
          <button type="button" data-del-table data-label="Supprimer la table" title="Supprimer la table">Supprimer</button></header>
        ${cols}${fks}</article>`;
    })
    .join("");
  generate();
}

function bind() {
  const root = $("#tool-panel");
  const read = (el) => (el.type === "checkbox" ? el.checked : el.value);

  root.addEventListener("input", (e) => {
    const el = e.target;
    const k = el.dataset.k;
    if (el.matches("[data-g]")) {
      const [obj, key] = el.dataset.g.split(".");
      (obj === "state" ? state : state[obj])[key] = read(el);
    } else if (k) {
      const row = el.closest("[data-t]");
      const t = state.tables[row.dataset.t];
      const target =
        k === "tname"
          ? t
          : "c" in row.dataset
            ? t.cols[row.dataset.c]
            : "f" in row.dataset
              ? t.fks[row.dataset.f]
              : t;
      target[k === "tname" ? "name" : k] = read(el);
      if (k === "refTable") target.refCol = "";
    }
    generate();
  });

  root.addEventListener("change", (e) => {
    if (e.target.dataset.k && e.target.dataset.k !== "type") render();
  });

  root.addEventListener("click", (e) => {
    const el = e.target.closest("button");
    if (!el) return;
    const row = el.closest("[data-t]");
    const t = row && state.tables[row.dataset.t];
    if (el.matches("[data-add-table]")) {
      const id = {
        name: `table_${state.tables.length + 1}`,
        cols: [],
        fks: [],
      };
      id.cols.push({ ...newCol("id", "INT"), pk: true, nn: true, ai: true });
      state.tables.push(id);
    } else if (el.matches("[data-add-col]")) t.cols.push(newCol());
    else if (el.matches("[data-add-fk]"))
      t.fks.push({ col: "", refTable: "", refCol: "", onDelete: "NO ACTION" });
    else if (el.matches("[data-del-col]")) t.cols.splice(row.dataset.c, 1);
    else if (el.matches("[data-del-fk]")) t.fks.splice(row.dataset.f, 1);
    else if (el.matches("[data-del-table]"))
      state.tables.splice(row.dataset.t, 1);
    else if (el.matches("[data-copy]")) {
      navigator.clipboard.writeText(sql);
      el.textContent = "Copié !";
      setTimeout(() => (el.textContent = "Copier"), 1200);
      return;
    } else if (el.matches("[data-download]")) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([sql], { type: "text/sql" }));
      a.download = `${state.db || "schema"}.sql`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    } else return;
    render();
  });
}

bind();
$("[data-add-table]").click();
