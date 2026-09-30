export const CRITERIOS = [
  { id: 'irradiacao', nome: 'Irradiação solar (kWh/m²)', tipo: 'beneficio', peso: 0.3 },
  { id: 'custo', nome: 'Custo de instalação (R$/kW)', tipo: 'custo', peso: 0.25 },
  { id: 'populacao', nome: 'População atendida (mil)', tipo: 'beneficio', peso: 0.25 },
  { id: 'acesso', nome: 'Acesso à rede (%)', tipo: 'custo', peso: 0.2 },
]
const m = (ibge, nome, uf, lat, lng, irradiacao, custo, populacao, acesso) => ({ ibge, nome, uf, lat, lng, valores: { irradiacao, custo, populacao, acesso } })
export const MUNICIPIOS = [
  m('2927408', 'Salvador', 'BA', -12.97, -38.5, 5.3, 4800, 2418, 99),
  m('2910800', 'Feira de Santana', 'BA', -12.27, -38.96, 5.5, 4600, 616, 97),
  m('2933307', 'Vitória da Conquista', 'BA', -14.86, -40.84, 5.6, 4500, 370, 94),
  m('2904407', 'Campo Formoso', 'BA', -10.51, -40.32, 6.0, 4300, 72, 82),
  m('2917508', 'Juazeiro', 'BA', -9.41, -40.5, 6.1, 4200, 237, 90),
  m('2919207', 'Lauro de Freitas', 'BA', -12.89, -38.32, 5.2, 4900, 203, 99),
  m('2925303', 'Porto Seguro', 'BA', -16.44, -39.06, 5.1, 5000, 168, 91),
]
