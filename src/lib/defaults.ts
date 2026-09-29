import type { Ministry, SiteSettings } from "./types";

export const defaultSettings: SiteSettings = {
  heroTitle: "Tu iglesia local, donde la atmósfera de Dios se manifiesta en amor",
  heroSubtitle:
    "Somos creyentes de Jesús y embajadores de él. Ven y forma parte de un reino que vive en abundancia.",
  city: "Chiclayo, Lambayeque",
  address: "Calle Bolívar 755, Chiclayo",
  sunday: "Domingos 10:00 a.m.",
  wednesday: "Miércoles 8:00 p.m.",
  pastor: "Alberto Dávila Camacho",
  pastorsLabel: "Pastores Alberto y Kelly Dávila",
  aboutQuote:
    "Somos creyentes de Jesús y embajadores de él. Ven y forma parte de un reino que vive en abundancia.",
  aboutText:
    "Somos una comunidad en Chiclayo, departamento de Lambayeque en Perú, y nos une la fe en Dios Padre, Dios Hijo y el Espíritu Santo. Reconocemos haber recibido provisión de Dios siendo pastoreados con amor.",
  vision:
    "Ver vidas transformadas por Jesús en cada casa, cada generación y cada rincón de nuestra ciudad. Una iglesia local donde el amor de Dios se vuelve visible.",
  history:
    "Iglesia Cristiana Zoe nació en Chiclayo como una familia de fe. Crecemos en células —nuestros grupos celulares— y en los servicios de la congregación, formando discípulos que llevan el amor de Cristo a su casa, su campus y su trabajo.",
  values: [
    {
      title: "Amor",
      text: "El amor de Dios es la atmósfera de nuestra casa. Recibimos a cada persona con dignidad.",
    },
    {
      title: "Palabra",
      text: "La Escritura guía nuestra fe, nuestros hogares y la manera en que servimos.",
    },
    {
      title: "Comunidad",
      text: "Nadie crece solo. Las células y los ministerios son el lugar donde la fe se hace familia.",
    },
    {
      title: "Generosidad",
      text: "Dar es adoración. Sostenemos la obra y alcanzamos a quienes más lo necesitan.",
    },
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

export const defaultMinistries: Ministry[] = [
  {
    slug: "zoe-kids",
    name: "Zoe Kids",
    age_range: "Hasta los 11 años",
    summary: "Ambiente seguro y dinámico para niños.",
    body: "Un lugar divertido, seguro y lleno de vida donde los más pequeños aprenden la Palabra de Dios a través de juegos, dinámicas y enseñanzas adaptadas a su edad. ¡El mejor lugar para tus hijos los domingos!",
    sort_order: 1,
    accent: "#f3d7b0",
  },
  {
    slug: "zoe-teens",
    name: "Zoe Teens",
    age_range: "De 12 a 18 años",
    summary: "Espacio para adolescentes y etapa escolar.",
    body: "Un espacio creado especialmente para adolescentes en etapa escolar. Aquí pueden hacer amigos, resolver dudas reales sobre la fe y vivir su juventud con propósito.",
    sort_order: 2,
    accent: "#f6c7a1",
  },
  {
    slug: "zoe-young",
    name: "Zoe Young",
    age_range: "De 18 a 28 años",
    summary: "Jóvenes y universitarios.",
    body: "Jóvenes, universitarios y profesionales jóvenes reuniéndose para conectar, debatir temas de la vida real, adorar juntos y crecer en comunidad. ¡Este es tu lugar!",
    sort_order: 3,
    accent: "#efb184",
  },
  {
    slug: "grupos-28",
    name: "Grupos 28+",
    age_range: "De 28 años en adelante",
    summary: "Adultos y matrimonios.",
    body: "Comunidades orientadas a adultos y matrimonios en etapas de desarrollo profesional, familiar y espiritual más maduras. Un espacio para edificarnos mutuamente y crecer en la fe.",
    sort_order: 4,
    accent: "#e8c3a4",
  },
];
