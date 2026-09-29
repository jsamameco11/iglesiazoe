import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "supabase", "schema.sql");

const { Client } = pg;

const themes = [
  ["EL PODER DE LAS PALABRAS 2", "2026-09-27"],
  ["EL PODER DE LAS PALABRAS", "2026-09-20"],
  ["EL CUERPO DE CRISTO NUESTRA PROVISIÓN DE SANIDAD", "2026-09-13"],
  ["LA SANGRE QUE HABLA A MI FAVOR", "2026-09-06"],
  ["PREPARA TU MOCHILA PARA ENFRENTAR EL DIA MALO", "2026-08-30"],
  ["LA REALIDAD DE LA PRESENCIA DE DIOS. BENEFICIOS.", "2026-08-23"],
  ["BUSCADORES DE SU PRESENCIA 2", "2026-08-16"],
  ["BUSCADORES DE SU PRESENCIA", "2026-08-10"],
  ["LA REALIDAD DE LA PRESENCIA DE DIOS", "2026-08-02"],
  ["FAMILIAS EXITOSAS Y BENDECIDAS EN CRISTO 6", "2026-07-29"],
  ["FAMILIAS EXITOSAS Y BENDECIDAS EN CRISTO 5", "2026-07-19"],
  ["FAMILIAS EXITOSAS Y BENDECIDAS EN CRISTO 4", "2026-07-12"],
  ["FAMILIAS EXITOSAS Y BENDECIDAS EN CRISTO 3", "2026-07-05"],
  ["FAMILIAS EXITOSAS Y BENDECIDAS EN CRISTO 2", "2026-06-28"],
  ["FAMILIAS EXITOSAS Y BENDECIDAS EN CRISTO", "2026-06-21"],
  ["PADRES ENTENDIDOS EN LOS TIEMPOS", "2026-06-15"],
  ["LA PAZ DE DIOS VENCIENDO LA ANSIEDAD DE ESTE MUNDO 2", "2026-06-09"],
  ["LA PAZ DE DIOS VENCIENDO LA ANSIEDAD DE ESTE MUNDO 2", "2026-05-31"],
  ["LA PAZ DE DIOS VENCIENDO LA ANSIEDAD DE ESTE MUNDO", "2026-05-24"],
  ["LOS DEBERES DE UN SIERVO", "2026-05-17"],
  ["LOS NO DE UNA MADRE PARA SUS HIJOS", "2026-05-10"],
  ["MADRE, CUIDADO Y PROVISIÓN DEL AMOR DE DIOS", "2026-05-03"],
  ["ANDAD EN EL ESPÍRITU 2", "2026-04-26"],
  ["ANDAD EN EL ESPÍRITU", "2026-04-19"],
  ["EL LIBRE ALBEDRÍO, BASE DEL AMOR VERDADERO", "2026-04-12"],
  ["ACUÉRDATE DE JESUCRISTO RESUCITADO", "2026-04-05"],
  ["ATENTOS", "2026-03-29"],
  ["LA ORACIÓN EN LENGUAS, CIENCIA Y ESPÍRITU EN LA ORACIÓN", "2026-03-22"],
  ["SIGAN REPOSANDO EN MI, YO SOY SU DIOS TODOPODEROSO", "2026-03-15"],
  ["LA ORACIÓN CON LA AYUDA DEL ESPÍRITU SANTO", "2026-03-08"],
  ["CONOCEME QUE YO SOY DIOS", "2026-03-01"],
  ["LA GRACIA Y EL ESPÍRITU SANTO, UNA RELACIÓN INSEPARABLE 3", "2026-02-22"],
  ["LA GRACIA, LA REALIDAD DEL NUEVO PACTO", "2026-02-15"],
  ["LA GRACIA Y EL ESPÍRITU SANTO, UNA RELACIÓN INSEPARABLE 2", "2026-02-08"],
  ["LA GRACIA Y EL ESPÍRITU SANTO, UNA RELACIÓN INSEPARABLE", "2026-02-01"],
  ["SANTIFICACIÓN, UNA VIDA GUIADA POR EL ESPÍRITU SANTO", "2026-01-25"],
  ["DIOS, NUESTRO PARÁKLETO POR EXCELENCIA", "2026-01-18"],
  ["LA CONVENIENCIA DEL ESPÍRITU SANTO", "2026-01-12"],
];

const gCells = [
  ["01G", 1, "VIVAR Adolfo Gilberto"],
  ["02G", 2, "CASTAÑEDA Kiara"],
  ["03G", 3, "TEQUEN Miriam Julliana"],
  ["04G", 4, "ELERA Segundo"],
  ["05G", 5, "SIFUENTES VIGO Maria Betsabe"],
  ["06G", 6, "ASALDE Sheyla Vanessa"],
  ["07G", 7, "MARTINEZ BARBELIEVEN"],
  ["08G", 8, "PAICO Victor Raul"],
  ["09G", 9, "PAUCAR Cesar Augusto"],
  ["10G", 10, "AU Estefany Michell"],
  ["11G", 11, "SILVA Jhonny Henrry"],
  ["12G", 12, "ARTEAGA Christian"],
];

async function createAuthUser(client, { username, password, fullName, role, networkId, cellIds }) {
  const email = `${username.toLowerCase()}@lideres.iglesiacristianazoe.pe`;
  const found = await client.query("select id from public.profiles where username = $1", [username.toLowerCase()]);
  let id = found.rows[0]?.id;

  if (!id) {
    const existingAuth = await client.query("select id from auth.users where email = $1", [email]);
    id = existingAuth.rows[0]?.id;
  }

  if (!id) {
    const instance = await client.query("select id from auth.instances limit 1");
    id = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    await client.query(
      `insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token,
        is_sso_user, is_anonymous
      ) values (
        $1, $2, 'authenticated', 'authenticated', $3,
        extensions.crypt($4, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        $5::jsonb, now(), now(),
        '', '', '', '', '', '', '', '', false, false
      )`,
      [
        instance.rows[0]?.id || "00000000-0000-0000-0000-000000000000",
        id,
        email,
        password,
        JSON.stringify({ username, full_name: fullName }),
      ],
    );
  }

  const identity = await client.query("select id from auth.identities where user_id = $1", [id]);
  if (!identity.rowCount) {
    await client.query(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
       values ($1, $2, $3::jsonb, 'email', now(), now())`,
      [id, id, JSON.stringify({ sub: id, email, email_verified: true })],
    );
  }

  await client.query(
    `insert into public.profiles (id, username, full_name, role, network_id) values ($1,$2,$3,$4,$5)
     on conflict (id) do nothing`,
    [id, username.toLowerCase(), fullName, role, networkId],
  );
  for (const cellId of cellIds) {
    await client.query(
      `insert into public.user_cells (user_id, cell_id) values ($1,$2) on conflict do nothing`,
      [id, cellId],
    );
  }
  return id;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const exists = await client.query(
    "select to_regclass('public.networks') as name",
  );
  if (!exists.rows[0].name) {
    const sql = fs.readFileSync(schemaPath, "utf8");
    await client.query(sql);
    console.log("Esquema creado");
  } else {
    console.log("Esquema ya existía");
    const sql = fs.readFileSync(schemaPath, "utf8");
    const start = sql.indexOf("create or replace function public.admin_create_user");
    const end = sql.indexOf("revoke all on function public.admin_create_user");
    await client.query(sql.slice(start, end));
  }

  const letters = "ABCDEFGHIJKL".split("");
  for (const code of letters) {
    await client.query(
      `insert into public.networks (code, name) values ($1, $2) on conflict (code) do nothing`,
      [code, `Red ${code}`],
    );
  }
  const networks = await client.query("select id, code from public.networks");
  const networkId = Object.fromEntries(networks.rows.map((row) => [row.code, row.id]));

  for (const code of letters) {
    if (code === "G") continue;
    for (let number = 1; number <= 6; number++) {
      const cellCode = String(number).padStart(2, "0") + code;
      await client.query(
        `insert into public.cells (network_id, number, code) values ($1,$2,$3) on conflict (code) do nothing`,
        [networkId[code], number, cellCode],
      );
    }
  }

  for (const [code, number, leader] of gCells) {
    await client.query(
      `insert into public.cells (network_id, number, code, leader_name, assistant_name, host_name, address, meeting_day)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (code) do update set leader_name = excluded.leader_name`,
      [
        networkId.G,
        number,
        code,
        leader,
        code === "05G" ? "HERNANDEZ IGNACIO EDITH" : null,
        code === "05G" ? "MESTANZA PÉREZ Consuelo" : null,
        code === "05G" ? "Anecdotaas 347 PJ. 3 de octubre" : null,
        code === "05G" ? "Viernes" : null,
      ],
    );
  }
  const parent = await client.query("select id from public.cells where code = '06G'");
  if (parent.rowCount) {
    await client.query(
      `insert into public.cells (network_id, parent_id, number, code, leader_name)
       values ($1,$2,1,'0106G',$3)
       on conflict (code) do update set parent_id = excluded.parent_id, leader_name = excluded.leader_name`,
      [networkId.G, parent.rows[0].id, "FRIAS Nicole"],
    );
  }

  const cell05 = await client.query("select id from public.cells where code = '05G'");
  if (cell05.rowCount) {
    for (const name of [
      "SIFUENTES VIGO Maria Betsabe",
      "HERNANDEZ IGNACIO EDITH",
      "MESTANZA PÉREZ Consuelo",
    ]) {
      await client.query(
        `insert into public.cell_members (cell_id, full_name)
         select $1, $2
         where not exists (select 1 from public.cell_members where cell_id = $1 and full_name = $2)`,
        [cell05.rows[0].id, name],
      );
    }
  }

  const defaultSettings = {
    heroTitle: "Tu iglesia local, donde la atmósfera de Dios se manifiesta en amor",
    heroSubtitle: "Somos creyentes de Jesús y embajadores de él. Ven y forma parte de un reino que vive en abundancia.",
    city: "Chiclayo, Lambayeque",
    address: "Calle Bolívar 755, Chiclayo",
    sunday: "Domingos 10:00 a.m.",
    wednesday: "Miércoles 8:00 p.m.",
    pastor: "Alberto Dávila Camacho",
    pastorsLabel: "Pastores Alberto y Kelly Dávila",
    aboutQuote: "Somos creyentes de Jesús y embajadores de él. Ven y forma parte de un reino que vive en abundancia.",
    aboutText: "Somos una comunidad en Chiclayo, departamento de Lambayeque en Perú, y nos une la fe en Dios Padre, Dios Hijo y el Espíritu Santo. Reconocemos haber recibido provisión de Dios siendo pastoreados con amor.",
    vision: "Ver vidas transformadas por Jesús en cada casa, cada generación y cada rincón de nuestra ciudad. Una iglesia local donde el amor de Dios se vuelve visible.",
    history: "Iglesia Cristiana Zoe nació en Chiclayo como una familia de fe. Crecemos en células —nuestros grupos celulares— y en los servicios de la congregación, formando discípulos que llevan el amor de Cristo a su casa, su campus y su trabajo.",
    values: [
      { title: "Amor", text: "El amor de Dios es la atmósfera de nuestra casa. Recibimos a cada persona con dignidad." },
      { title: "Palabra", text: "La Escritura guía nuestra fe, nuestros hogares y la manera en que servimos." },
      { title: "Comunidad", text: "Nadie crece solo. Las células y los ministerios son el lugar donde la fe se hace familia." },
      { title: "Generosidad", text: "Dar es adoración. Sostenemos la obra y alcanzamos a quienes más lo necesitan." },
    ],
    facebook: "https://www.facebook.com/iglesiacristiana.defezoe/",
    youtube: "",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Calle+Bolivar+755+Chiclayo",
    liveYoutubeId: "",
    bankSoles: "",
    bankSolesCci: "",
    bankDollars: "",
    bankDollarsCci: "",
    yape: "",
    cardUrl: "",
    phone: "",
    email: "",
  };
  const defaultMinistries = [
    ["zoe-kids", "Zoe Kids", "Hasta los 11 años", "Ambiente seguro y dinámico para niños.", "Un lugar divertido, seguro y lleno de vida donde los más pequeños aprenden la Palabra de Dios a través de juegos, dinámicas y enseñanzas adaptadas a su edad. ¡El mejor lugar para tus hijos los domingos!", 1, "#f3d7b0"],
    ["zoe-teens", "Zoe Teens", "De 12 a 18 años", "Espacio para adolescentes y etapa escolar.", "Un espacio creado especialmente para adolescentes en etapa escolar. Aquí pueden hacer amigos, resolver dudas reales sobre la fe y vivir su juventud con propósito.", 2, "#f6c7a1"],
    ["zoe-young", "Zoe Young", "De 18 a 28 años", "Jóvenes y universitarios.", "Jóvenes, universitarios y profesionales jóvenes reuniéndose para conectar, debatir temas de la vida real, adorar juntos y crecer en comunidad. ¡Este es tu lugar!", 3, "#efb184"],
    ["grupos-28", "Grupos 28+", "De 28 años en adelante", "Adultos y matrimonios.", "Comunidades orientadas a adultos y matrimonios en etapas de desarrollo profesional, familiar y espiritual más maduras. Un espacio para edificarnos mutuamente y crecer en la fe.", 4, "#e8c3a4"],
  ];

  await client.query(
    `insert into public.site_settings (key, value) values ('site', $1::jsonb)
     on conflict (key) do nothing`,
    [JSON.stringify(defaultSettings)],
  );

  for (const ministry of defaultMinistries) {
    await client.query(
      `insert into public.ministries (slug, name, age_range, summary, body, sort_order, accent)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (slug) do nothing`,
      ministry,
    );
  }

  for (const [title, themeDate] of themes) {
    await client.query(
      `insert into public.themes (title, audience, theme_date)
       select $1, 'Iglesia', $2::date
       where not exists (select 1 from public.themes where title = $1 and theme_date = $2::date)`,
      [title, themeDate],
    );
  }

  await client.query(
    `insert into public.baptism_events (event_date, location, notes)
     select current_date + 21, 'Iglesia Cristiana Zoe', 'Asistir a la charla informativa previa.'
     where not exists (select 1 from public.baptism_events)`,
  );

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword) {
    await createAuthUser(client, {
      username: "admin",
      password: adminPassword,
      fullName: "Administrador",
      role: "admin",
      networkId: null,
      cellIds: [],
    });
  }

  if (process.env.LEADER_USER && process.env.LEADER_PASSWORD && cell05.rowCount) {
    await createAuthUser(client, {
      username: process.env.LEADER_USER,
      password: process.env.LEADER_PASSWORD,
      fullName: "SIFUENTES VIGO Maria Betsabe",
      role: "red_leader",
      networkId: networkId.G,
      cellIds: [cell05.rows[0].id],
    });
  }

  console.log("Datos listos");
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
