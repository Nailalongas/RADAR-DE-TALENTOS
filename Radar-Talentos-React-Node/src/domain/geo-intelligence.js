import { normalizeName } from './research.js';

export const EARTH_RADIUS_KM = 6371;

export const RADIUS_PRESETS_KM = [25, 50, 100, 150, 200, 300, 500, 750, 1000];

export const BRAZIL_REGIONS = [
  { code: 'N', name: 'Norte', ufs: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'] },
  {
    code: 'NE',
    name: 'Nordeste',
    ufs: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  },
  { code: 'CO', name: 'Centro-Oeste', ufs: ['DF', 'GO', 'MS', 'MT'] },
  { code: 'SE', name: 'Sudeste', ufs: ['ES', 'MG', 'RJ', 'SP'] },
  { code: 'S', name: 'Sul', ufs: ['PR', 'RS', 'SC'] },
];

export const UF_TO_REGION = Object.fromEntries(
  BRAZIL_REGIONS.flatMap(r => r.ufs.map(uf => [uf, r.code]))
);

export const DEFAULT_MUNICIPALITIES = [
  { ibge_code: '4106902', name: 'Curitiba', uf: 'PR', region_code: 'S', latitude: -25.4284, longitude: -49.2733, population: 1773718, gdp_per_capita: 67691.3 },
  { ibge_code: '4125506', name: 'São José dos Pinhais', uf: 'PR', region_code: 'S', latitude: -25.5304, longitude: -49.2083, population: 329628, gdp_per_capita: 84512.0 },
  { ibge_code: '4105805', name: 'Colombo', uf: 'PR', region_code: 'S', latitude: -25.2925, longitude: -49.2262, population: 232212, gdp_per_capita: 29450.0 },
  { ibge_code: '4119152', name: 'Pinhais', uf: 'PR', region_code: 'S', latitude: -25.4429, longitude: -49.1927, population: 127019, gdp_per_capita: 64210.0 },
  { ibge_code: '4101804', name: 'Araucária', uf: 'PR', region_code: 'S', latitude: -25.5859, longitude: -49.4047, population: 151666, gdp_per_capita: 171200.0 },
  { ibge_code: '4104204', name: 'Campo Largo', uf: 'PR', region_code: 'S', latitude: -25.4595, longitude: -49.529, population: 136327, gdp_per_capita: 45120.0 },
  { ibge_code: '4118204', name: 'Paranaguá', uf: 'PR', region_code: 'S', latitude: -25.5205, longitude: -48.5095, population: 145829, gdp_per_capita: 89300.0 },
  { ibge_code: '4119905', name: 'Ponta Grossa', uf: 'PR', region_code: 'S', latitude: -25.0945, longitude: -50.1633, population: 358371, gdp_per_capita: 56890.0 },
  { ibge_code: '4113700', name: 'Londrina', uf: 'PR', region_code: 'S', latitude: -23.3103, longitude: -51.1628, population: 555965, gdp_per_capita: 44120.0 },
  { ibge_code: '4115200', name: 'Maringá', uf: 'PR', region_code: 'S', latitude: -23.421, longitude: -51.9331, population: 409657, gdp_per_capita: 53840.0 },
  { ibge_code: '4104808', name: 'Cascavel', uf: 'PR', region_code: 'S', latitude: -24.9578, longitude: -53.4595, population: 348051, gdp_per_capita: 48750.0 },
  { ibge_code: '4108304', name: 'Foz do Iguaçu', uf: 'PR', region_code: 'S', latitude: -25.5469, longitude: -54.5882, population: 285415, gdp_per_capita: 61200.0 },
  { ibge_code: '4209102', name: 'Joinville', uf: 'SC', region_code: 'S', latitude: -26.3044, longitude: -48.8487, population: 616317, gdp_per_capita: 73450.0 },
  { ibge_code: '4202404', name: 'Blumenau', uf: 'SC', region_code: 'S', latitude: -26.9194, longitude: -49.0661, population: 361261, gdp_per_capita: 63800.0 },
  { ibge_code: '4208203', name: 'Itajaí', uf: 'SC', region_code: 'S', latitude: -26.9078, longitude: -48.6619, population: 264054, gdp_per_capita: 138400.0 },
  { ibge_code: '4202008', name: 'Balneário Camboriú', uf: 'SC', region_code: 'S', latitude: -26.9906, longitude: -48.6348, population: 139155, gdp_per_capita: 52100.0 },
  { ibge_code: '4205407', name: 'Florianópolis', uf: 'SC', region_code: 'S', latitude: -27.5954, longitude: -48.548, population: 537211, gdp_per_capita: 48900.0 },
  { ibge_code: '4204202', name: 'Chapecó', uf: 'SC', region_code: 'S', latitude: -27.1004, longitude: -52.6152, population: 254785, gdp_per_capita: 59300.0 },
  { ibge_code: '4204608', name: 'Criciúma', uf: 'SC', region_code: 'S', latitude: -28.6775, longitude: -49.3697, population: 214493, gdp_per_capita: 47200.0 },
  { ibge_code: '4314902', name: 'Porto Alegre', uf: 'RS', region_code: 'S', latitude: -30.0346, longitude: -51.2177, population: 1332845, gdp_per_capita: 78586.94 },
  { ibge_code: '4305108', name: 'Caxias do Sul', uf: 'RS', region_code: 'S', latitude: -29.1678, longitude: -51.1794, population: 463501, gdp_per_capita: 68120.0 },
  { ibge_code: '4309308', name: 'Gramado', uf: 'RS', region_code: 'S', latitude: -29.3746, longitude: -50.8764, population: 40134, gdp_per_capita: 74500.0 },
  { ibge_code: '4314407', name: 'Pelotas', uf: 'RS', region_code: 'S', latitude: -31.7654, longitude: -52.3376, population: 325685, gdp_per_capita: 34200.0 },
  { ibge_code: '4316907', name: 'Santa Maria', uf: 'RS', region_code: 'S', latitude: -29.6842, longitude: -53.8069, population: 271735, gdp_per_capita: 36900.0 },
  { ibge_code: '3550308', name: 'São Paulo', uf: 'SP', region_code: 'SE', latitude: -23.5505, longitude: -46.6333, population: 11451999, gdp_per_capita: 93156.23 },
  { ibge_code: '3509502', name: 'Campinas', uf: 'SP', region_code: 'SE', latitude: -22.9056, longitude: -47.0608, population: 1139047, gdp_per_capita: 65400.0 },
  { ibge_code: '3548500', name: 'Santos', uf: 'SP', region_code: 'SE', latitude: -23.9608, longitude: -46.3336, population: 418608, gdp_per_capita: 69800.0 },
  { ibge_code: '3543402', name: 'Ribeirão Preto', uf: 'SP', region_code: 'SE', latitude: -21.1775, longitude: -47.8103, population: 698642, gdp_per_capita: 58200.0 },
  { ibge_code: '3549904', name: 'São José dos Campos', uf: 'SP', region_code: 'SE', latitude: -23.1791, longitude: -45.8872, population: 697054, gdp_per_capita: 67300.0 },
  { ibge_code: '3552205', name: 'Sorocaba', uf: 'SP', region_code: 'SE', latitude: -23.5015, longitude: -47.4526, population: 723682, gdp_per_capita: 62100.0 },
  { ibge_code: '3304557', name: 'Rio de Janeiro', uf: 'RJ', region_code: 'SE', latitude: -22.9068, longitude: -43.1729, population: 6211223, gdp_per_capita: 59400.0 },
  { ibge_code: '3303302', name: 'Niterói', uf: 'RJ', region_code: 'SE', latitude: -22.8832, longitude: -43.1034, population: 481749, gdp_per_capita: 108400.0 },
  { ibge_code: '3106200', name: 'Belo Horizonte', uf: 'MG', region_code: 'SE', latitude: -19.9167, longitude: -43.9345, population: 2315560, gdp_per_capita: 46800.0 },
  { ibge_code: '3170206', name: 'Uberlândia', uf: 'MG', region_code: 'SE', latitude: -18.9186, longitude: -48.2772, population: 713224, gdp_per_capita: 61900.0 },
  { ibge_code: '3136702', name: 'Juiz de Fora', uf: 'MG', region_code: 'SE', latitude: -21.7642, longitude: -43.3503, population: 540756, gdp_per_capita: 36400.0 },
  { ibge_code: '3205309', name: 'Vitória', uf: 'ES', region_code: 'SE', latitude: -20.3155, longitude: -40.3128, population: 322869, gdp_per_capita: 96500.0 },
  { ibge_code: '3205200', name: 'Vila Velha', uf: 'ES', region_code: 'SE', latitude: -20.3297, longitude: -40.2925, population: 467722, gdp_per_capita: 34900.0 },
  { ibge_code: '5300108', name: 'Brasília', uf: 'DF', region_code: 'CO', latitude: -15.7975, longitude: -47.8919, population: 2817381, gdp_per_capita: 98600.0 },
  { ibge_code: '5208707', name: 'Goiânia', uf: 'GO', region_code: 'CO', latitude: -16.6869, longitude: -49.2648, population: 1437366, gdp_per_capita: 42900.0 },
  { ibge_code: '5103403', name: 'Cuiabá', uf: 'MT', region_code: 'CO', latitude: -15.6014, longitude: -56.0979, population: 650877, gdp_per_capita: 49300.0 },
  { ibge_code: '5002704', name: 'Campo Grande', uf: 'MS', region_code: 'CO', latitude: -20.4697, longitude: -54.6201, population: 898100, gdp_per_capita: 40200.0 },
  { ibge_code: '2927408', name: 'Salvador', uf: 'BA', region_code: 'NE', latitude: -12.9777, longitude: -38.5016, population: 2417678, gdp_per_capita: 27400.0 },
  { ibge_code: '2611606', name: 'Recife', uf: 'PE', region_code: 'NE', latitude: -8.0476, longitude: -34.877, population: 1488920, gdp_per_capita: 38900.0 },
  { ibge_code: '2304400', name: 'Fortaleza', uf: 'CE', region_code: 'NE', latitude: -3.7319, longitude: -38.5267, population: 2428708, gdp_per_capita: 30100.0 },
  { ibge_code: '2408102', name: 'Natal', uf: 'RN', region_code: 'NE', latitude: -5.7945, longitude: -35.211, population: 751300, gdp_per_capita: 33200.0 },
  { ibge_code: '2507507', name: 'João Pessoa', uf: 'PB', region_code: 'NE', latitude: -7.1195, longitude: -34.845, population: 833932, gdp_per_capita: 28600.0 },
  { ibge_code: '2704302', name: 'Maceió', uf: 'AL', region_code: 'NE', latitude: -9.6498, longitude: -35.7089, population: 957916, gdp_per_capita: 29100.0 },
  { ibge_code: '2800308', name: 'Aracaju', uf: 'SE', region_code: 'NE', latitude: -10.9472, longitude: -37.0731, population: 602757, gdp_per_capita: 32400.0 },
  { ibge_code: '2111300', name: 'São Luís', uf: 'MA', region_code: 'NE', latitude: -2.5307, longitude: -44.3068, population: 1037775, gdp_per_capita: 35700.0 },
  { ibge_code: '2211001', name: 'Teresina', uf: 'PI', region_code: 'NE', latitude: -5.0892, longitude: -42.8016, population: 866300, gdp_per_capita: 27900.0 },
  { ibge_code: '1302603', name: 'Manaus', uf: 'AM', region_code: 'N', latitude: -3.119, longitude: -60.0217, population: 2063689, gdp_per_capita: 50200.0 },
  { ibge_code: '1501402', name: 'Belém', uf: 'PA', region_code: 'N', latitude: -1.4558, longitude: -48.4902, population: 1303403, gdp_per_capita: 26800.0 },
  { ibge_code: '1721000', name: 'Palmas', uf: 'TO', region_code: 'N', latitude: -10.1753, longitude: -48.2982, population: 302692, gdp_per_capita: 36500.0 },
  { ibge_code: '1100205', name: 'Porto Velho', uf: 'RO', region_code: 'N', latitude: -8.7612, longitude: -63.9004, population: 460434, gdp_per_capita: 43800.0 },
  { ibge_code: '1200401', name: 'Rio Branco', uf: 'AC', region_code: 'N', latitude: -9.9754, longitude: -67.8249, population: 364756, gdp_per_capita: 29400.0 },
  { ibge_code: '1600303', name: 'Macapá', uf: 'AP', region_code: 'N', latitude: 0.0349, longitude: -51.0694, population: 442933, gdp_per_capita: 27100.0 },
  { ibge_code: '1400100', name: 'Boa Vista', uf: 'RR', region_code: 'N', latitude: 2.8235, longitude: -60.6758, population: 413486, gdp_per_capita: 33600.0 },
  { ibge_code: '2201903', name: 'Bom Jesus', uf: 'PI', region_code: 'NE', latitude: -9.0714, longitude: -44.359, population: 28796, gdp_per_capita: 38100.0 },
  { ibge_code: '2401701', name: 'Bom Jesus', uf: 'RN', region_code: 'NE', latitude: -5.9864, longitude: -35.5792, population: 9952, gdp_per_capita: 14200.0 },
  { ibge_code: '4302303', name: 'Bom Jesus', uf: 'RS', region_code: 'S', latitude: -28.6686, longitude: -50.4167, population: 11202, gdp_per_capita: 41500.0 },
];

export const EVENT_MODALITIES = [
  {
    id: 'shows-musica',
    name: 'Shows e música',
    submodalities: [
      { id: 'shows-musica:sertanejo', name: 'Sertanejo' },
      { id: 'shows-musica:rock', name: 'Rock' },
      { id: 'shows-musica:pop', name: 'Pop' },
      { id: 'shows-musica:rap-hip-hop', name: 'Rap/Hip-hop' },
      { id: 'shows-musica:funk', name: 'Funk' },
      { id: 'shows-musica:pagode', name: 'Pagode' },
      { id: 'shows-musica:samba', name: 'Samba' },
      { id: 'shows-musica:mpb', name: 'MPB' },
      { id: 'shows-musica:gospel', name: 'Gospel' },
      { id: 'shows-musica:jazz-blues', name: 'Jazz/Blues' },
      { id: 'shows-musica:eletronico', name: 'Eletrônico' },
      { id: 'shows-musica:forro', name: 'Forró' },
      { id: 'shows-musica:outros', name: 'Outros' },
    ],
  },
  {
    id: 'teatro-espetaculos',
    name: 'Teatro e espetáculos',
    submodalities: [
      { id: 'teatro-espetaculos:comedia', name: 'Comédia' },
      { id: 'teatro-espetaculos:drama', name: 'Drama' },
      { id: 'teatro-espetaculos:musical', name: 'Musical' },
      { id: 'teatro-espetaculos:danca', name: 'Dança' },
      { id: 'teatro-espetaculos:opera', name: 'Ópera' },
      { id: 'teatro-espetaculos:ballet', name: 'Ballet' },
      { id: 'teatro-espetaculos:circo', name: 'Circo' },
      { id: 'teatro-espetaculos:artes-cenicas', name: 'Artes cênicas' },
    ],
  },
  {
    id: 'humor',
    name: 'Humor',
    submodalities: [
      { id: 'humor:stand-up', name: 'Stand-up' },
      { id: 'humor:improvisacao', name: 'Improvisação' },
      { id: 'humor:shows-humoristicos', name: 'Shows humorísticos' },
    ],
  },
  {
    id: 'palestras-educacao',
    name: 'Palestras e educação',
    submodalities: [
      { id: 'palestras-educacao:lideranca', name: 'Liderança' },
      { id: 'palestras-educacao:vendas', name: 'Vendas' },
      { id: 'palestras-educacao:negocios', name: 'Negócios' },
      { id: 'palestras-educacao:financas', name: 'Finanças' },
      { id: 'palestras-educacao:saude', name: 'Saúde' },
      { id: 'palestras-educacao:tecnologia', name: 'Tecnologia' },
      {
        id: 'palestras-educacao:desenvolvimento-pessoal',
        name: 'Desenvolvimento pessoal',
      },
      { id: 'palestras-educacao:workshops', name: 'Workshops' },
      { id: 'palestras-educacao:cursos', name: 'Cursos' },
      { id: 'palestras-educacao:imersoes', name: 'Imersões' },
      { id: 'palestras-educacao:congressos', name: 'Congressos' },
    ],
  },
  {
    id: 'corridas',
    name: 'Corridas',
    submodalities: [
      { id: 'corridas:5km', name: '5 km' },
      { id: 'corridas:10km', name: '10 km' },
      { id: 'corridas:meia-maratona', name: 'Meia maratona' },
      { id: 'corridas:maratona', name: 'Maratona' },
      { id: 'corridas:trail-run', name: 'Trail run' },
      { id: 'corridas:corrida-infantil', name: 'Corrida infantil' },
      { id: 'corridas:outras-distancias', name: 'Outras distâncias' },
    ],
  },
  {
    id: 'esportes',
    name: 'Esportes',
    submodalities: [
      { id: 'esportes:ciclismo', name: 'Ciclismo' },
      { id: 'esportes:triatlo', name: 'Triatlo' },
      { id: 'esportes:lutas', name: 'Lutas' },
      { id: 'esportes:futebol', name: 'Futebol' },
      { id: 'esportes:competicoes', name: 'Competições' },
      { id: 'esportes:outros', name: 'Outros' },
    ],
  },
  {
    id: 'festas-festivais',
    name: 'Festas e festivais',
    submodalities: [
      { id: 'festas-festivais:festivais-musicais', name: 'Festivais musicais' },
      { id: 'festas-festivais:culturais', name: 'Culturais' },
      { id: 'festas-festivais:festas-tematicas', name: 'Festas temáticas' },
      {
        id: 'festas-festivais:festas-tradicionais',
        name: 'Festas tradicionais',
      },
    ],
  },
  {
    id: 'infantil-familia',
    name: 'Infantil e família',
    submodalities: [
      { id: 'infantil-familia:personagens', name: 'Personagens' },
      { id: 'infantil-familia:espetaculos', name: 'Espetáculos' },
      { id: 'infantil-familia:parques', name: 'Parques' },
      { id: 'infantil-familia:experiencias', name: 'Experiências' },
      { id: 'infantil-familia:eventos-infantis', name: 'Eventos infantis' },
    ],
  },
  {
    id: 'gastronomia',
    name: 'Gastronomia',
    submodalities: [
      { id: 'gastronomia:festivais', name: 'Festivais' },
      { id: 'gastronomia:cerveja', name: 'Cerveja' },
      { id: 'gastronomia:vinho', name: 'Vinho' },
      { id: 'gastronomia:degustacoes', name: 'Degustações' },
      {
        id: 'gastronomia:experiencias-gastronomicas',
        name: 'Experiências gastronômicas',
      },
    ],
  },
  {
    id: 'feiras-exposicoes',
    name: 'Feiras e exposições',
    submodalities: [
      { id: 'feiras-exposicoes:negocios', name: 'Negócios' },
      { id: 'feiras-exposicoes:tecnologia', name: 'Tecnologia' },
      { id: 'feiras-exposicoes:geek', name: 'Geek' },
      { id: 'feiras-exposicoes:automoveis', name: 'Automóveis' },
      { id: 'feiras-exposicoes:cultura', name: 'Cultura' },
      { id: 'feiras-exposicoes:convencoes', name: 'Convenções' },
    ],
  },
  {
    id: 'experiencias-turismo',
    name: 'Experiências e turismo',
    submodalities: [
      { id: 'experiencias-turismo:imersoes', name: 'Imersões' },
      {
        id: 'experiencias-turismo:exposicoes-interativas',
        name: 'Exposições interativas',
      },
      { id: 'experiencias-turismo:passeios', name: 'Passeios' },
      {
        id: 'experiencias-turismo:atracoes-com-ingresso',
        name: 'Atrações com ingresso',
      },
    ],
  },
  {
    id: 'outros',
    name: 'Outros / não classificado',
    submodalities: [{ id: 'outros:revisao', name: 'Fila de revisão' }],
  },
];

export const TICKETING_SOURCES = [
  {
    id: 'sympla',
    name: 'Sympla',
    segment: 'Eventos diversos',
    websiteUrl: 'https://www.sympla.com.br',
  },
  {
    id: 'eventim',
    name: 'Eventim',
    segment: 'Shows e espetáculos',
    websiteUrl: 'https://www.eventim.com.br',
  },
  {
    id: 'ticketmaster',
    name: 'Ticketmaster',
    segment: 'Grandes eventos',
    websiteUrl: 'https://www.ticketmaster.com.br',
  },
  {
    id: 'ingresse',
    name: 'Ingresse',
    segment: 'Festivais, festas e entretenimento',
    websiteUrl: 'https://www.ingresse.com',
  },
  {
    id: 'ticketsports',
    name: 'Ticket Sports',
    segment: 'Corridas e esportes',
    websiteUrl: 'https://www.ticketsports.com.br',
  },
  {
    id: 'ticket360',
    name: 'Ticket360',
    segment: 'Shows e eventos',
    websiteUrl: 'https://www.ticket360.com.br',
  },
  {
    id: 'blueticket',
    name: 'Blueticket',
    segment: 'Entretenimento',
    websiteUrl: 'https://www.blueticket.com.br',
  },
  {
    id: 'diskingressos',
    name: 'Disk Ingressos',
    segment: 'Shows, teatro e humor',
    websiteUrl: 'https://www.diskingressos.com.br',
  },
  {
    id: 'bilheteriadigital',
    name: 'Bilheteria Digital',
    segment: 'Eventos diversos',
    websiteUrl: 'https://www.bilheteriadigital.com',
  },
  {
    id: 'uhuu',
    name: 'Uhuu',
    segment: 'Espetáculos e entretenimento',
    websiteUrl: 'https://uhuu.com',
  },
];

export function isValidCoordinate(lat, lon) {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Distância geodésica em linha reta (fórmula de Haversine), coordenadas WGS84,
 * raio médio terrestre de 6.371 km. Não representa distância rodoviária.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    throw new Error('Coordenadas geográficas inválidas.');
  }
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_KM * c;
}

export function validateRadiusKm(radiusKm) {
  if (radiusKm === null || radiusKm === undefined || radiusKm === '') {
    return null;
  }
  const n = Number(radiusKm);
  if (!Number.isFinite(n) || n < 0 || n > 5000) {
    throw new Error('Raio em quilômetros inválido (use entre 0 e 5.000 km).');
  }
  return n;
}

export function filterMunicipalitiesByGeo(
  municipalities = [],
  {
    region = '',
    uf = '',
    centerMunicipalityId = '',
    radiusKm = null,
    search = '',
  } = {}
) {
  const validRadius = validateRadiusKm(radiusKm);
  let center = null;
  if (centerMunicipalityId) {
    center = (municipalities || []).find(
      m => String(m.ibge_code) === String(centerMunicipalityId)
    );
    if (!center) {
      throw new Error(
        `Município de referência não encontrado: ${centerMunicipalityId}`
      );
    }
  }

  const normalizedSearch = normalizeName(search);
  const results = [];

  for (const m of municipalities || []) {
    const mRegion = m.region_code || UF_TO_REGION[m.uf] || '';
    if (region && region !== 'all' && mRegion !== region) continue;
    if (uf && uf !== 'all' && m.uf !== uf) continue;
    if (normalizedSearch) {
      const label = normalizeName(`${m.name} ${m.uf} ${m.ibge_code}`);
      if (!label.includes(normalizedSearch)) continue;
    }

    let distanceKm = null;
    if (center) {
      distanceKm = Number(
        haversineDistanceKm(
          center.latitude,
          center.longitude,
          m.latitude,
          m.longitude
        ).toFixed(2)
      );
      if (validRadius !== null && distanceKm > validRadius) {
        continue;
      }
    }

    results.push({
      ...m,
      region_code: mRegion,
      displayLabel: `${m.name} (${m.uf})`,
      distanceKm,
    });
  }

  if (center) {
    results.sort(
      (a, b) =>
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
        a.name.localeCompare(b.name, 'pt-BR')
    );
  } else {
    results.sort(
      (a, b) =>
        (b.population || 0) - (a.population || 0) ||
        a.name.localeCompare(b.name, 'pt-BR')
    );
  }

  return {
    center,
    radiusKm: validRadius,
    municipalities: results,
  };
}

const CLASSIFICATION_RULES = [
  {
    modalityId: 'corridas',
    pattern: /\b(corrida|maratona|meia maratona|trail run|5\s?km|10\s?km|21\s?km|42\s?km|night run|circuito de corrida)\b/i,
    subRules: [
      ['corridas:maratona', /\b(?<!meia )maratona|42\s?km\b/i],
      ['corridas:meia-maratona', /\bmeia maratona|21\s?km\b/i],
      ['corridas:trail-run', /\btrail\s?run\b/i],
      ['corridas:corrida-infantil', /\binfantil|kids\b/i],
      ['corridas:10km', /\b10\s?km\b/i],
      ['corridas:5km', /\b5\s?km\b/i],
    ],
    defaultSub: 'corridas:outras-distancias',
  },
  {
    modalityId: 'humor',
    pattern: /\b(stand[\s-]?up|comediante|humor|humoristico|improviso|improvisacao)\b/i,
    subRules: [
      ['humor:stand-up', /\bstand[\s-]?up\b/i],
      ['humor:improvisacao', /\bimprovis/i],
    ],
    defaultSub: 'humor:shows-humoristicos',
  },
  {
    modalityId: 'teatro-espetaculos',
    pattern: /\b(teatro|peca teatral|musical|espetaculo|ballet|bale|opera|circo|danca|monologo)\b/i,
    subRules: [
      ['teatro-espetaculos:musical', /\bmusical|musicais\b/i],
      ['teatro-espetaculos:comedia', /\bcomedia\b/i],
      ['teatro-espetaculos:drama', /\bdrama\b/i],
      ['teatro-espetaculos:danca', /\bdanca\b/i],
      ['teatro-espetaculos:opera', /\bopera\b/i],
      ['teatro-espetaculos:ballet', /\bballet|bale\b/i],
      ['teatro-espetaculos:circo', /\bcirco|circense\b/i],
    ],
    defaultSub: 'teatro-espetaculos:artes-cenicas',
  },
  {
    modalityId: 'palestras-educacao',
    pattern: /\b(palestra|palestrante|workshop|congresso|imersao|curso|seminario|masterclass|simposio|mentoria)\b/i,
    subRules: [
      ['palestras-educacao:lideranca', /\blideranca\b/i],
      ['palestras-educacao:vendas', /\bvendas|comercial\b/i],
      ['palestras-educacao:financas', /\bfinancas|investimento\b/i],
      ['palestras-educacao:tecnologia', /\btecnologia|ia|inteligencia artificial\b/i],
      ['palestras-educacao:workshops', /\bworkshop\b/i],
      ['palestras-educacao:congressos', /\bcongresso|simposio\b/i],
      ['palestras-educacao:imersoes', /\bimersao\b/i],
      ['palestras-educacao:cursos', /\bcurso|masterclass\b/i],
    ],
    defaultSub: 'palestras-educacao:negocios',
  },
  {
    modalityId: 'festas-festivais',
    pattern: /\b(festival|festa|reveillon|carnaval|arraial|oktoberfest)\b/i,
    subRules: [
      ['festas-festivais:festivais-musicais', /\bfestival\b/i],
      ['festas-festivais:festas-tradicionais', /\bcarnaval|reveillon|arraial|oktoberfest\b/i],
    ],
    defaultSub: 'festas-festivais:festas-tematicas',
  },
  {
    modalityId: 'shows-musica',
    pattern: /\b(show|turne|acustico|ao vivo|sertanejo|rock|pagode|samba|mpb|gospel|forro|piseiro|funk|rap|trap|hip[\s-]?hop|eletronico|dj|jazz|blues)\b/i,
    subRules: [
      ['shows-musica:sertanejo', /\bsertanej/i],
      ['shows-musica:rock', /\brock\b/i],
      ['shows-musica:pop', /\bpop\b/i],
      ['shows-musica:pagode', /\bpagode\b/i],
      ['shows-musica:samba', /\bsamba\b/i],
      ['shows-musica:mpb', /\bmpb\b/i],
      ['shows-musica:gospel', /\bgospel|louvor\b/i],
      ['shows-musica:forro', /\bforro|piseiro\b/i],
      ['shows-musica:funk', /\bfunk\b/i],
      ['shows-musica:rap-hip-hop', /\brap|trap|hip[\s-]?hop\b/i],
      ['shows-musica:eletronico', /\beletronic|dj|rave\b/i],
      ['shows-musica:jazz-blues', /\bjazz|blues\b/i],
    ],
    defaultSub: 'shows-musica:outros',
  },
  {
    modalityId: 'esportes',
    pattern: /\b(ciclismo|pedal|triatlo|triathlon|luta|mma|boxe|jiu[\s-]?jitsu|futebol|campeonato|torneio)\b/i,
    subRules: [
      ['esportes:ciclismo', /\bciclismo|pedal|bike\b/i],
      ['esportes:triatlo', /\btriatlo|triathlon\b/i],
      ['esportes:lutas', /\bluta|mma|boxe|jiu\b/i],
      ['esportes:futebol', /\bfutebol\b/i],
    ],
    defaultSub: 'esportes:competicoes',
  },
  {
    modalityId: 'gastronomia',
    pattern: /\b(gastronomi|degustacao|vinho|cerveja artesanal|churrasco|jantar harmonizado)\b/i,
    subRules: [
      ['gastronomia:vinho', /\bvinho\b/i],
      ['gastronomia:cerveja', /\bcerveja\b/i],
      ['gastronomia:degustacoes', /\bdegustacao|harmonizad\b/i],
    ],
    defaultSub: 'gastronomia:experiencias-gastronomicas',
  },
  {
    modalityId: 'infantil-familia',
    pattern: /\b(infantil|criancas|familia|bonecos|personagens|parque infantil)\b/i,
    subRules: [
      ['infantil-familia:personagens', /\bpersonagen\b/i],
      ['infantil-familia:parques', /\bparque\b/i],
    ],
    defaultSub: 'infantil-familia:eventos-infantis',
  },
  {
    modalityId: 'feiras-exposicoes',
    pattern: /\b(feira|exposicao|expo|bienal|convencao|salao|geek|anime|comic)\b/i,
    subRules: [
      ['feiras-exposicoes:geek', /\bgeek|anime|comic|cosplay\b/i],
      ['feiras-exposicoes:negocios', /\bnegocios|empresarial\b/i],
      ['feiras-exposicoes:tecnologia', /\btecnologia|inovacao\b/i],
    ],
    defaultSub: 'feiras-exposicoes:cultura',
  },
  {
    id: 'experiencias-turismo',
    modalityId: 'experiencias-turismo',
    pattern: /\b(experiencia imersiva|exposicao interativa|passeio turistico|tour)\b/i,
    subRules: [
      ['experiencias-turismo:exposicoes-interativas', /\binterativa\b/i],
      ['experiencias-turismo:passeios', /\bpasseio|tour\b/i],
    ],
    defaultSub: 'experiencias-turismo:atracoes-com-ingresso',
  },
];

export function classifyEventModality({
  title = '',
  description = '',
  originalCategory = '',
  modalityId = '',
  submodalityId = '',
} = {}) {
  if (modalityId) {
    const foundMod = EVENT_MODALITIES.find(m => m.id === modalityId);
    if (foundMod) {
      const foundSub =
        foundMod.submodalities.find(s => s.id === submodalityId) ||
        foundMod.submodalities[0];
      return {
        modalityId: foundMod.id,
        modalityName: foundMod.name,
        submodalityId: foundSub?.id || null,
        submodalityName: foundSub?.name || null,
        confidence: 'alta',
        needsReview: false,
        originalCategory: originalCategory || '',
      };
    }
  }

  const normalizedCat = normalizeName(originalCategory);
  const normalizedText = normalizeName(
    `${originalCategory} ${title} ${description}`
  );

  for (const rule of CLASSIFICATION_RULES) {
    const matchedCat = rule.pattern.test(normalizedCat);
    const matchedText = rule.pattern.test(normalizedText);
    if (matchedCat || matchedText) {
      let chosenSub = rule.defaultSub;
      for (const [subId, subRegex] of rule.subRules) {
        if (subRegex.test(normalizedText)) {
          chosenSub = subId;
          break;
        }
      }
      const modObj = EVENT_MODALITIES.find(m => m.id === rule.modalityId);
      const subObj = modObj?.submodalities.find(s => s.id === chosenSub);
      return {
        modalityId: rule.modalityId,
        modalityName: modObj?.name || rule.modalityId,
        submodalityId: chosenSub,
        submodalityName: subObj?.name || chosenSub,
        confidence: matchedCat ? 'alta' : 'moderada',
        needsReview: !matchedCat,
        originalCategory: originalCategory || '',
      };
    }
  }

  return {
    modalityId: 'outros',
    modalityName: 'Outros / não classificado',
    submodalityId: 'outros:revisao',
    submodalityName: 'Fila de revisão',
    confidence: 'baixa',
    needsReview: true,
    originalCategory: originalCategory || '',
  };
}

export function normalizeEventIdentityToken(value) {
  return normalizeName(value)
    .replace(/\b(turne|tour|show|apresentacao|ao vivo|oficial|edicao)\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chave canônica para deduplicar o mesmo evento anunciado em múltiplas plataformas
 * sem fundir sessões em datas diferentes, cidades diferentes ou edições anuais.
 */
export function canonicalEventKey({
  title = '',
  attractionName = '',
  venueName = '',
  ibgeCode = '',
  eventDateStart = '',
  deliveryMode = 'presencial',
} = {}) {
  const coreName =
    normalizeEventIdentityToken(attractionName) ||
    normalizeEventIdentityToken(title);
  const coreTitle = normalizeEventIdentityToken(title);
  const coreVenue = normalizeEventIdentityToken(venueName);
  const locationToken =
    deliveryMode === 'online' ? 'online' : String(ibgeCode || 'no-ibge');
  const dateToken = String(eventDateStart || '').slice(0, 10);
  return [
    coreName || coreTitle,
    coreVenue || coreTitle,
    locationToken,
    dateToken,
  ].join('|');
}

/**
 * Matriz conceitual do Radar de Oportunidades (Seção 11):
 * - Alta audiência + pouca oferta observada -> Sinal de oportunidade a investigar
 * - Alta audiência + muita oferta observada -> Mercado potencialmente competitivo
 * - Baixa audiência + pouca oferta observada -> Mercado experimental
 * - Baixa audiência + muita oferta observada -> Possível excesso de oferta
 * Jamais trata ausência de cobertura como zero/baixa audiência.
 */
export function computeOpportunitiesMatrix({
  municipalities = [],
  audienceByIbge = new Map(),
  eventsByIbge = new Map(),
} = {}) {
  const withCoverage = [];
  const insufficientCoverage = [];

  for (const city of municipalities) {
    const aud = audienceByIbge.get(city.ibge_code);
    const ev = eventsByIbge.get(city.ibge_code);
    const hasAudience = aud !== undefined && aud !== null && Number.isFinite(aud.value);
    const hasEvents = ev !== undefined && ev !== null && Number.isFinite(ev.count);

    if (!hasAudience || !hasEvents) {
      insufficientCoverage.push({
        ibgeCode: city.ibge_code,
        cityName: city.name,
        uf: city.uf,
        population: city.population,
        distanceKm: city.distanceKm ?? null,
        audience: hasAudience ? aud.value : null,
        audienceSource: hasAudience ? aud.source : null,
        audienceProvenance: hasAudience ? aud.provenance : 'indisponivel',
        eventsCount: hasEvents ? ev.count : null,
        classification: 'Cobertura insuficiente para cruzamento',
        quadrant: 'insufficient_coverage',
        explanation: !hasAudience && !hasEvents
          ? 'Sem relatório de audiência municipal e sem cobertura de eventos nesta praça.'
          : !hasAudience
            ? 'Há eventos monitorados, mas falta relatório de audiência municipal para o talento/modalidade.'
            : 'Há audiência conhecida, mas a cobertura de eventos ainda não foi importada para esta praça.',
      });
      continue;
    }

    withCoverage.push({
      city,
      aud,
      ev,
    });
  }

  const median = values => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const audienceThreshold = median(withCoverage.map(x => x.aud.value));
  const eventsThreshold = median(withCoverage.map(x => x.ev.count));

  const classified = withCoverage.map(({ city, aud, ev }) => {
    const highAudience = aud.value >= audienceThreshold && aud.value > 0;
    const highOffer = ev.count > eventsThreshold && ev.count > 0;

    let quadrant;
    let classification;
    let explanation;

    if (highAudience && !highOffer) {
      quadrant = 'opportunity';
      classification = 'Alta audiência + pouca oferta observada';
      explanation =
        'Sinal de oportunidade a investigar: audiência regional acima da mediana do recorte com baixa quantidade de eventos publicados.';
    } else if (highAudience && highOffer) {
      quadrant = 'competitive';
      classification = 'Alta audiência + muita oferta observada';
      explanation =
        'Mercado potencialmente competitivo: praça com audiência consolidada e oferta ativa de eventos na modalidade.';
    } else if (!highAudience && !highOffer) {
      quadrant = 'experimental';
      classification = 'Baixa audiência + pouca oferta observada';
      explanation =
        'Mercado experimental: audiência conhecida e oferta de eventos abaixo da mediana do recorte.';
    } else {
      quadrant = 'oversupply';
      classification = 'Baixa audiência + muita oferta observada';
      explanation =
        'Possível excesso de oferta: volume de eventos publicados acima da mediana para uma audiência local menor.';
    }

    return {
      ibgeCode: city.ibge_code,
      cityName: city.name,
      uf: city.uf,
      population: city.population,
      distanceKm: city.distanceKm ?? null,
      audience: aud.value,
      audiencePer100k:
        city.population > 0
          ? Number(((aud.value / city.population) * 100000).toFixed(1))
          : null,
      audienceSource: aud.source,
      audienceProvenance: aud.provenance,
      eventsCount: ev.count,
      quadrant,
      classification,
      explanation,
    };
  });

  classified.sort((a, b) => {
    const order = {
      opportunity: 0,
      competitive: 1,
      experimental: 2,
      oversupply: 3,
    };
    return (
      order[a.quadrant] - order[b.quadrant] ||
      (b.audience || 0) - (a.audience || 0)
    );
  });

  return {
    thresholds: {
      audienceMedian: audienceThreshold,
      eventsMedian: eventsThreshold,
    },
    evaluatedCount: classified.length,
    insufficientCount: insufficientCoverage.length,
    items: [...classified, ...insufficientCoverage],
    disclaimer:
      'Sinal analítico baseado nos relatórios de audiência e nos eventos publicados nas fontes monitoradas. Volume de eventos publicados não equivale a venda de ingressos nem garante resultado financeiro.',
  };
}

/**
 * Radar Score versionado (Seção 8):
 * - 'v1-growth': crescimento 35%, aceleração 25%, consistência 20%, posição na categoria 10%, interesse regional 10%
 * - 'v1-commercial': concentração geográfica 30%, crescimento 25%, demanda comprovada 20%, histórico de eventos 15%, engajamento 10%
 * Nunca substitui demanda comprovada ausente por quantidade de eventos publicados;
 * renormaliza apenas sobre componentes efetivamente disponíveis e informa a cobertura.
 */
export function computeRadarScore(
  indicators = {},
  { formulaVersion = 'v1-growth', modalityId = 'shows-musica' } = {}
) {
  const weights =
    formulaVersion === 'v1-commercial'
      ? {
          geoConcentration: 0.3,
          growth: 0.25,
          provenDemand: 0.2,
          eventHistory: 0.15,
          engagement: 0.1,
        }
      : {
          growth: 0.35,
          acceleration: 0.25,
          consistency: 0.2,
          categoryPosition: 0.1,
          regionalInterest: 0.1,
        };

  let weightedSum = 0;
  let availableWeight = 0;
  const availableComponents = [];
  const missingComponents = [];

  for (const [key, weight] of Object.entries(weights)) {
    const val = indicators[key];
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 100) {
      weightedSum += val * weight;
      availableWeight += weight;
      availableComponents.push(key);
    } else {
      missingComponents.push(key);
    }
  }

  if (availableWeight === 0) {
    return {
      formulaVersion,
      modalityId,
      score: null,
      confidence: 'indisponivel',
      coveragePct: 0,
      availableComponents,
      missingComponents,
    };
  }

  const normalizedScore = Number((weightedSum / availableWeight).toFixed(1));
  const coveragePct = Math.round(availableWeight * 100);
  const confidence =
    coveragePct >= 80 ? 'alta' : coveragePct >= 50 ? 'moderada' : 'baixa';

  return {
    formulaVersion,
    modalityId,
    score: normalizedScore,
    confidence,
    coveragePct,
    availableComponents,
    missingComponents,
  };
}
