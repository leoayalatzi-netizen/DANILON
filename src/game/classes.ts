export type Stat = "FUE" | "DES" | "CON" | "INT" | "SAB" | "CAR";
export interface HeroClass {
  id: string; base: string; nombre: string; concepto: string;
  pg: number; ca: number; stats: Record<Stat, number>; habilidades: string[];
}
/** Clásicos de D&D con identidad propia (nombres/estética originales, mecánicas en SRD). */
export const CLASES: HeroClass[] = [
  { id: "guardian", base: "Paladín", nombre: "Guardián de Ceniza", concepto: "Caballero juramentado con armadura de obsidiana agrietada que filtra brasas", pg: 44, ca: 18,
    stats: { FUE: 16, DES: 8, CON: 15, INT: 8, SAB: 11, CAR: 15 }, habilidades: ["Golpe Sagrado", "Juramento de Brasa", "Imponer Manos"] },
  { id: "tejedor", base: "Mago", nombre: "Tejedor de Escarcha", concepto: "Erudito que cose hechizos con hilos de hielo y constelaciones", pg: 24, ca: 12,
    stats: { FUE: 8, DES: 14, CON: 12, INT: 17, SAB: 12, CAR: 10 }, habilidades: ["Lanza de Hielo", "Telaraña Estelar", "Contrahechizo"] },
  { id: "sombra", base: "Pícaro", nombre: "Hoja de Sombra", concepto: "Asesina de gremio nocturno, capa de humo y dagas de hueso", pg: 30, ca: 15,
    stats: { FUE: 10, DES: 18, CON: 12, INT: 13, SAB: 11, CAR: 14 }, habilidades: ["Ataque Furtivo", "Paso Umbrío", "Veneno de Viuda"] },
  { id: "vigia", base: "Clérigo", nombre: "Vigía del Alba", concepto: "Sacerdote-astrónomo que canaliza la luz del amanecer", pg: 36, ca: 16,
    stats: { FUE: 12, DES: 10, CON: 14, INT: 11, SAB: 17, CAR: 13 }, habilidades: ["Rayo de Alba", "Palabra Curativa", "Escudo de Fe"] },
  { id: "rompe", base: "Bárbaro", nombre: "Rompe-Cumbres", concepto: "Guerrero de clan del norte, hacha de basalto y runas de tormenta", pg: 52, ca: 14,
    stats: { FUE: 18, DES: 12, CON: 17, INT: 7, SAB: 10, CAR: 9 }, habilidades: ["Furia", "Tajo Sísmico", "Grito de Guerra"] },
  { id: "custodio", base: "Druida", nombre: "Custodio del Musgo", concepto: "Guardián del bosque con astas de ciervo y raíces vivas", pg: 34, ca: 13,
    stats: { FUE: 10, DES: 12, CON: 14, INT: 12, SAB: 17, CAR: 10 }, habilidades: ["Forma de Lobo", "Zarzas", "Llamar Tormenta"] },
];
