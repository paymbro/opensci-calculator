// Scientific constants (47, CODATA 2022 — the categories/symbols are those listed in the
// fx-991CW+ UK User's Guide p.67; values from NIST "allascii.txt", 2022 CODATA adjustment) and unit
// conversions (categories/commands from the User's Guide p.68-69; factors from NIST SP 811 (2008)).
import { Real } from './num.js';

const c = (cat, sym, name, value) => ({ cat, sym, name, value });
export const SCI_CONST_CATEGORIES = ['Universal', 'Electromagnetic', 'Atomic&Nuclear', 'Physico-Chem', 'Adopted Values', 'Other'];
export const SCI_CONSTANTS = [
  c('Universal', 'h', 'Planck constant', '6.62607015e-34'),
  c('Universal', 'ℏ', 'reduced Planck constant', '1.054571817e-34'),
  c('Universal', 'c', 'speed of light', '299792458'),
  c('Universal', 'ε₀', 'electric constant', '8.8541878188e-12'),
  c('Universal', 'μ₀', 'magnetic constant', '1.25663706127e-6'),
  c('Universal', 'Z₀', 'characteristic impedance of vacuum', '376.730313412'),
  c('Universal', 'G', 'Newtonian constant of gravitation', '6.67430e-11'),
  c('Universal', 'lP', 'Planck length', '1.616255e-35'),
  c('Universal', 'tP', 'Planck time', '5.391247e-44'),
  c('Electromagnetic', 'μN', 'nuclear magneton', '5.0507837393e-27'),
  c('Electromagnetic', 'μB', 'Bohr magneton', '9.2740100657e-24'),
  c('Electromagnetic', 'e', 'elementary charge', '1.602176634e-19'),
  c('Electromagnetic', 'Φ₀', 'magnetic flux quantum', '2.067833848e-15'),
  c('Electromagnetic', 'G₀', 'conductance quantum', '7.748091729e-5'),
  c('Electromagnetic', 'KJ', 'Josephson constant', '4.835978484e14'),
  c('Electromagnetic', 'RK', 'von Klitzing constant', '25812.80745'),
  c('Atomic&Nuclear', 'mp', 'proton mass', '1.67262192595e-27'),
  c('Atomic&Nuclear', 'mn', 'neutron mass', '1.67492750056e-27'),
  c('Atomic&Nuclear', 'me', 'electron mass', '9.1093837139e-31'),
  c('Atomic&Nuclear', 'mμ', 'muon mass', '1.883531627e-28'),
  c('Atomic&Nuclear', 'a₀', 'Bohr radius', '5.29177210544e-11'),
  c('Atomic&Nuclear', 'α', 'fine-structure constant', '7.2973525643e-3'),
  c('Atomic&Nuclear', 'rₑ', 'classical electron radius', '2.8179403205e-15'),
  c('Atomic&Nuclear', 'λC', 'Compton wavelength', '2.42631023538e-12'),
  c('Atomic&Nuclear', 'γp', 'proton gyromagnetic ratio', '2.6752218708e8'),
  c('Atomic&Nuclear', 'λCp', 'proton Compton wavelength', '1.32140985360e-15'),
  c('Atomic&Nuclear', 'λCn', 'neutron Compton wavelength', '1.31959090382e-15'),
  c('Atomic&Nuclear', 'R∞', 'Rydberg constant', '10973731.568157'),
  c('Atomic&Nuclear', 'μp', 'proton magnetic moment', '1.41060679545e-26'),
  c('Atomic&Nuclear', 'μe', 'electron magnetic moment', '-9.2847646917e-24'),
  c('Atomic&Nuclear', 'μn', 'neutron magnetic moment', '-9.6623653e-27'),
  c('Atomic&Nuclear', 'μμ', 'muon magnetic moment', '-4.49044830e-26'),
  c('Atomic&Nuclear', 'mτ', 'tau mass', '3.16754e-27'),
  c('Physico-Chem', 'mu', 'atomic mass constant', '1.66053906892e-27'),
  c('Physico-Chem', 'F', 'Faraday constant', '96485.33212'),
  c('Physico-Chem', 'NA', 'Avogadro constant', '6.02214076e23'),
  c('Physico-Chem', 'k', 'Boltzmann constant', '1.380649e-23'),
  c('Physico-Chem', 'Vm', 'molar volume of ideal gas', '22.41396954e-3'),
  c('Physico-Chem', 'R', 'molar gas constant', '8.314462618'),
  c('Physico-Chem', 'c₁', 'first radiation constant', '3.741771852e-16'),
  c('Physico-Chem', 'c₂', 'second radiation constant', '1.438776877e-2'),
  c('Physico-Chem', 'σ', 'Stefan-Boltzmann constant', '5.670374419e-8'),
  c('Adopted Values', 'gₙ', 'standard acceleration of gravity', '9.80665'),
  c('Adopted Values', 'atm', 'standard atmosphere', '101325'),
  c('Adopted Values', 'RK-90', 'conventional value of von Klitzing constant', '25812.807'),
  c('Adopted Values', 'KJ-90', 'conventional value of Josephson constant', '4.835979e14'),
  c('Other', 't', 'Celsius temperature', '273.15'),
];

const mulBy = (k) => (x) => x.mul(Real.fromDecimalString(k));
const divBy = (k) => (x) => x.div(Real.fromDecimalString(k));
const u = (cat, name, f) => ({ cat, name, f });
export const UNIT_CATEGORIES = ['Length', 'Area', 'Volume', 'Mass', 'Velocity', 'Pressure', 'Energy', 'Power', 'Temperature'];
export const UNIT_CONVERSIONS = [
  u('Length', 'in▸cm', mulBy('2.54')), u('Length', 'cm▸in', divBy('2.54')),
  u('Length', 'ft▸m', mulBy('0.3048')), u('Length', 'm▸ft', divBy('0.3048')),
  u('Length', 'yd▸m', mulBy('0.9144')), u('Length', 'm▸yd', divBy('0.9144')),
  u('Length', 'mile▸km', mulBy('1.609344')), u('Length', 'km▸mile', divBy('1.609344')),
  u('Length', 'n mile▸m', mulBy('1852')), u('Length', 'm▸n mile', divBy('1852')),
  u('Length', 'pc▸km', mulBy('3.085678e13')), u('Length', 'km▸pc', divBy('3.085678e13')),
  u('Area', 'acre▸m²', mulBy('4046.873')), u('Area', 'm²▸acre', divBy('4046.873')),
  u('Volume', 'gal(US)▸L', mulBy('3.785411784')), u('Volume', 'L▸gal(US)', divBy('3.785411784')),
  u('Volume', 'gal(UK)▸L', mulBy('4.54609')), u('Volume', 'L▸gal(UK)', divBy('4.54609')),
  u('Mass', 'oz▸g', mulBy('28.349523125')), u('Mass', 'g▸oz', divBy('28.349523125')),
  u('Mass', 'lb▸kg', mulBy('0.45359237')), u('Mass', 'kg▸lb', divBy('0.45359237')),
  u('Velocity', 'km/h▸m/s', divBy('3.6')), u('Velocity', 'm/s▸km/h', mulBy('3.6')),
  u('Pressure', 'atm▸Pa', mulBy('101325')), u('Pressure', 'Pa▸atm', divBy('101325')),
  u('Pressure', 'mmHg▸Pa', mulBy('133.322387415')), u('Pressure', 'Pa▸mmHg', divBy('133.322387415')),
  u('Pressure', 'kgf/cm²▸Pa', mulBy('98066.5')), u('Pressure', 'Pa▸kgf/cm²', divBy('98066.5')),
  u('Pressure', 'lbf/in²▸kPa', mulBy('6.894757293168')), u('Pressure', 'kPa▸lbf/in²', divBy('6.894757293168')),
  u('Energy', 'kgf•m▸J', mulBy('9.80665')), u('Energy', 'J▸kgf•m', divBy('9.80665')),
  u('Energy', 'J▸cal₁₅', divBy('4.1858')), u('Energy', 'cal₁₅▸J', mulBy('4.1858')),
  u('Power', 'hp▸kW', mulBy('0.745699872')), u('Power', 'kW▸hp', divBy('0.745699872')),
  u('Temperature', '°F▸°C', (x) => x.sub(Real.int(32)).mul(Real.frac(5, 9))),
  u('Temperature', '°C▸°F', (x) => x.mul(Real.frac(9, 5)).add(Real.int(32))),
];
