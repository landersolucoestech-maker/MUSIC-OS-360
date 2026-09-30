/**
 * Brazilian states + a curated set of cities (capitals + major metros) for the
 * structured location picker. Not exhaustive (BR has ~5.570 municipalities); it
 * covers the capitals and the largest cities so campaigns target real places
 * instead of free text. Each option is "UF - Cidade".
 */

export interface BrLocation {
  stateCode: string;
  city: string;
  label: string;
}

const RAW: Array<[string, string[]]> = [
  ['AC', ['Rio Branco', 'Cruzeiro do Sul']],
  ['AL', ['Maceió', 'Arapiraca']],
  ['AP', ['Macapá', 'Santana']],
  ['AM', ['Manaus', 'Parintins']],
  ['BA', ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari']],
  ['CE', ['Fortaleza', 'Caucaia', 'Juazeiro do Norte']],
  ['DF', ['Brasília']],
  ['ES', ['Vitória', 'Vila Velha', 'Serra', 'Cariacica']],
  ['GO', ['Goiânia', 'Aparecida de Goiânia', 'Anápolis']],
  ['MA', ['São Luís', 'Imperatriz']],
  ['MT', ['Cuiabá', 'Várzea Grande', 'Rondonópolis']],
  ['MS', ['Campo Grande', 'Dourados']],
  ['MG', ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora', 'Betim']],
  ['PA', ['Belém', 'Ananindeua', 'Santarém']],
  ['PB', ['João Pessoa', 'Campina Grande']],
  ['PR', ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel']],
  ['PE', ['Recife', 'Jaboatão dos Guararapes', 'Olinda', 'Caruaru']],
  ['PI', ['Teresina', 'Parnaíba']],
  ['RJ', ['Rio de Janeiro', 'São Gonçalo', 'Duque de Caxias', 'Niterói', 'Nova Iguaçu']],
  ['RN', ['Natal', 'Mossoró']],
  ['RS', ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Canoas', 'Santa Maria']],
  ['RO', ['Porto Velho', 'Ji-Paraná']],
  ['RR', ['Boa Vista']],
  ['SC', ['Florianópolis', 'Joinville', 'Blumenau', 'Chapecó', 'Criciúma']],
  ['SP', ['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Ribeirão Preto', 'Sorocaba', 'Santos']],
  ['SE', ['Aracaju', 'Nossa Senhora do Socorro']],
  ['TO', ['Palmas', 'Araguaína']],
];

export const BR_STATES: Array<{ stateCode: string; name: string }> = [
  { stateCode: 'AC', name: 'Acre' }, { stateCode: 'AL', name: 'Alagoas' }, { stateCode: 'AP', name: 'Amapá' },
  { stateCode: 'AM', name: 'Amazonas' }, { stateCode: 'BA', name: 'Bahia' }, { stateCode: 'CE', name: 'Ceará' },
  { stateCode: 'DF', name: 'Distrito Federal' }, { stateCode: 'ES', name: 'Espírito Santo' }, { stateCode: 'GO', name: 'Goiás' },
  { stateCode: 'MA', name: 'Maranhão' }, { stateCode: 'MT', name: 'Mato Grosso' }, { stateCode: 'MS', name: 'Mato Grosso do Sul' },
  { stateCode: 'MG', name: 'Minas Gerais' }, { stateCode: 'PA', name: 'Pará' }, { stateCode: 'PB', name: 'Paraíba' },
  { stateCode: 'PR', name: 'Paraná' }, { stateCode: 'PE', name: 'Pernambuco' }, { stateCode: 'PI', name: 'Piauí' },
  { stateCode: 'RJ', name: 'Rio de Janeiro' }, { stateCode: 'RN', name: 'Rio Grande do Norte' }, { stateCode: 'RS', name: 'Rio Grande do Sul' },
  { stateCode: 'RO', name: 'Rondônia' }, { stateCode: 'RR', name: 'Roraima' }, { stateCode: 'SC', name: 'Santa Catarina' },
  { stateCode: 'SP', name: 'São Paulo' }, { stateCode: 'SE', name: 'Sergipe' }, { stateCode: 'TO', name: 'Tocantins' },
];

export const BR_LOCATIONS: BrLocation[] = [
  // Whole-state options ("UF - Todo o estado")
  ...BR_STATES.map((s) => ({ stateCode: s.stateCode, city: `${s.name} (todo o estado)`, label: `${s.stateCode} - ${s.name} (todo o estado)` })),
  // City options
  ...RAW.flatMap(([stateCode, cities]) => cities.map((city) => ({ stateCode, city, label: `${stateCode} - ${city}` }))),
];
