/**
 * Real grounds, stand by stand, keyed by stadium name (as in realClubs.ts).
 *
 * Format: four sides in the order main stand, one end, the opposite side,
 * the other end, as 'Name:size', separated by '|'. Sizes are roughly the
 * real capacities in thousands; the game scales them to the ground's real
 * total. Optional flags after the size: t = covered terrace (standing),
 * u = seats with no roof, o = no stand (open standing behind a rail).
 *
 * Corners follow '#': either 'bowl' (all four filled in, as in modern
 * stadiums) or four 'Name:size' corners clockwise from the north-west.
 * Grounds not listed here are laid out from their real capacity and level.
 */
export const REAL_STADIUMS: Record<string, string> = {
  // ---------------------------------------------------------------- Premier League
  'Emirates Stadium': 'West Stand:17|North Bank:12|East Stand:17|Clock End:11#bowl',
  Anfield: 'Main Stand:20.5|The Kop:12.8|Sir Kenny Dalglish Stand:11.5|Anfield Road End:16',
  'Etihad Stadium': 'Colin Bell Stand:16|North Stand:14|East Stand:16|South Stand:12#bowl',
  'Stamford Bridge': 'East Stand:11|Matthew Harding Stand:10.9|West Stand:13.5|Shed End:6.8',
  "St James' Park": 'Milburn Stand:16|Sir John Hall Stand:14|East Stand:7.5|Gallowgate End:13',
  'Tottenham Hotspur Stadium': 'West Stand:17|North Stand:14|East Stand:13|South Stand:17#bowl',
  'Villa Park': 'Trinity Road Stand:12.5|Holte End:13|Doug Ellis Stand:11|North Stand:8',
  'Old Trafford': 'Sir Alex Ferguson Stand:26|Stretford End:14|Sir Bobby Charlton Stand:12|East Stand:12#North-West Quadrant:5|North-East Quadrant:5|South-East Corner:1|South-West Corner:1',
  'City Ground': 'Peter Taylor Stand:6|Trent End:7.5|Brian Clough Stand:10|Bridgford Stand:7.7',
  'Amex Stadium': 'West Stand:13|North Stand:6|East Stand:8|South Stand:5#bowl',
  'Selhurst Park': 'Main Stand:5.5|Holmesdale Road Stand:8|Arthur Wait Stand:9.5|Whitehorse Lane Stand:2.3',
  'Vitality Stadium': 'Main Stand:4|Steve Fletcher Stand:2.4|East Stand:3|Ted MacDougall Stand:2#bowl',
  'Gtech Community Stadium': 'West Stand:5|Bees United Stand:4|East Stand:4|Ealing Road Stand:4#bowl',
  'Craven Cottage': 'Johnny Haynes Stand:4.7|Putney End:6.3|Riverside Stand:8.6|Hammersmith End:7.6',
  'Hill Dickinson Stadium': 'West Stand:13|North Stand:8|East Stand:10|South Stand:13#bowl',
  'London Stadium': 'West Stand:18|Sir Trevor Brooking Stand:10|East Stand:18|Bobby Moore Stand:10#bowl',
  Molineux: 'Steve Bull Stand:8|Stan Cullis Stand:8.5|Billy Wright Stand:9|Sir Jack Hayward Stand:5.5',
  'Elland Road': 'West Stand:7|Don Revie Stand:7.5|John Charles Stand:15|Norman Hunter Stand:6#North-West Corner:0|North-East Corner:1.5|South-East Corner:1.5|South-West Corner:0',
  'Stadium of Light': 'West Stand:18|North Stand:11|East Stand:11|South Stand:8#bowl',
  'Turf Moor': 'Bob Lord Stand:4|James Hargreaves Stand:8|Jimmy McIlroy Stand:6|Cricket Field Stand:4',

  // ---------------------------------------------------------------- Championship
  'King Power Stadium': 'West Stand:10|North Stand:6|East Stand:9|Kop:7#bowl',
  "St Mary's Stadium": 'Itchen Stand:9|Northam Stand:6|Kingsland Stand:9|Chapel Stand:6#bowl',
  'Portman Road': 'Sir Alf Ramsey Stand:9|Sir Bobby Robson Stand:7.5|Cobbold Stand:5|South Stand:5',
  'Bramall Lane': 'South Stand:8|Kop:10|John Street Stand:6|Tony Currie Stand:7#North-West Corner:1|North-East Corner:0|South-East Corner:0|South-West Corner:0',
  'Riverside Stadium': 'West Stand:10|North Stand:6|East Stand:11|South Stand:7#bowl',
  'Coventry Building Society Arena': 'West Stand:9|North Stand:7|East Stand:9|South Stand:7#bowl',
  'Racecourse Ground': 'Wrexham Lager Stand:3.5|The Kop:5|Mold Road Stand:3.5|Turf Hotel End:1.5',
  "St Andrew's": 'Main Stand:4.5|Tilton Road End:8|Gil Merrick Stand:8|Kop Stand:8',
  'The Hawthorns': 'East Stand:8|Birmingham Road End:8|West Stand:5|Smethwick End:5',
  'Carrow Road': 'Geoffrey Watling City Stand:4|Barclay Stand:7.6|Jarrold Stand:8|River End:7#North-West Corner:0|North-East Corner:0|South-East Corner:1|South-West Corner:0',
  'Ashton Gate': 'Lansdown Stand:11|Atyeo Stand:6|Dolman Stand:7|South Stand:3',
  'MKM Stadium': 'West Stand:10|North Stand:4|East Stand:7|South Stand:4#bowl',
  'The Den': 'West Stand:6|North Stand:3|East Stand:6|Cold Blow Lane:5',
  'Swansea.com Stadium': 'West Stand:7|North Stand:4|East Stand:6|South Stand:4#bowl',
  'Vicarage Road': 'Sir Elton John Stand:7|Rookery Stand:6.9|Graham Taylor Stand:6|Vicarage Road Stand:3',
  Deepdale: 'Sir Tom Finney Stand:6|Bill Shankly Kop:6|Alan Kelly Town End:6|Invincibles Pavilion:5',
  'Loftus Road': 'South Africa Road Stand:6|Loft End:3.5|Ellerslie Road Stand:3|School End:3.5#North-West Corner:0.6|North-East Corner:0.6|South-East Corner:0.6|South-West Corner:0.6',
  'Pride Park': 'West Stand:11|North Stand:6|East Stand:8|South Stand:7#bowl',
  'Ewood Park': 'Jack Walker Stand:11|Blackburn End:8|Riverside Stand:4.8|Darwen End:8',
  'The Valley': 'West Stand:9|North Stand:6|East Stand:7|Jimmy Seed Stand:3',
  'Fratton Park': 'South Stand:4|Fratton End:4|North Stand:7|Milton End:3',
  Hillsborough: 'South Stand:11|Leppings Lane:6|North Stand:9|Kop:12#North-West Corner:1.5|North-East Corner:0|South-East Corner:0|South-West Corner:0',
  'Kassam Stadium': 'West Stand:4|North Stand:4|East Stand:3|South End:0:o',
  'Kenilworth Road': 'Main Stand:4|Oak Road End:2|Bobbers Stand:3|Kenilworth Road Stand:3',
  'Cardiff City Stadium': 'Grandstand:9|Grange End:6|Ninian Stand:10|Canton Stand:6#bowl',
  'Home Park': 'Mayflower Grandstand:6|Barn Park End:3.5|Lyndhurst Stand:3.5|Devonport End:5',
  "John Smith's Stadium": 'Revell Ward Stand:7|North Stand:5|East Stand:7|South Stand:4',
  'Toughsheet Community Stadium': 'West Stand:8|North Stand:6|East Stand:8|Nat Lofthouse Stand:6#bowl',

  // ---------------------------------------------------------------- Leagues One and Two
  'Stadium MK': 'West Stand:9|North Stand:7|East Stand:9|South Stand:7#bowl',
  'Valley Parade': 'Main Stand:8|Kop:7|Midland Road Stand:4|TL Dallas Stand:2',
  'Bloomfield Road': 'Sir Stanley Matthews Stand:5|North Stand:4|Stan Mortensen Stand:3|Jimmy Armfield Stand:4',
  Oakwell: 'West Stand:4.7|North Stand:6|East Stand:7.5|Ponty End:4.5',
  'Vale Park': 'Lorne Street Stand:5|Hamil Road End:3.5|Railway Paddock:3.5|Bycars End:3',
  'Prenton Park': 'Main Stand:3|Kop:5.7|Johnny King Stand:3|Cowshed:5',
  'Brunton Park': 'Main Stand:6|Waterworks End:0:o|Paddock:4|Warwick Road End:5:t',
  'Priestfield Stadium': 'Medway Stand:3.7|Brian Moore Stand:2.5|Gordon Road Stand:2.5|Rainham End:2.9',
  'County Ground': "Arkell's Stand:5.5|Town End:3|Don Rogers Stand:4.5|Stratton Bank:2.5:o",
  'Blundell Park': 'Findus Stand:4.5|Pontoon Stand:2.1|Main Stand:2.4|Osmond Stand:2.1',
  'Edgeley Park': 'Main Stand:4|Cheadle End:5|Danny Bergara Stand:1.5|Railway End:1.5:t',
  'Meadow Lane': 'Derek Pavis Stand:5|Kop:5|Jimmy Sirrel Stand:5|Haydn Green Family Stand:4',
  'Boundary Park': 'Joe Royle Stand:2.4|Rochdale Road End:3.7|Main Stand:3.6|Chaddy End:3.8',
  'Roots Hall': 'West Stand:3|North Bank:3|East Stand:3|South Stand:3',

  // ---------------------------------------------------------------- Scotland
  'Celtic Park': 'Main Stand:8|Lisbon Lions Stand:13|North Stand:26|Jock Stein Stand:13#North-West Corner:1|North-East Corner:1|South-East Corner:0|South-West Corner:0',
  'Ibrox Stadium': 'Bill Struth Main Stand:21|Broomloan Road Stand:7.5|Sandy Jardine Stand:11|Copland Road Stand:8#North-West Corner:1|North-East Corner:1|South-East Corner:1|South-West Corner:1',
  'Tynecastle Park': 'Main Stand:7|Roseburn Stand:3.5|Wheatfield Stand:6|Gorgie Stand:3',
  'Pittodrie Stadium': 'Main Stand:4.5|Richard Donald Stand:6.8|South Stand:6.6|Merkland Stand:2.6',
  'Easter Road': 'West Stand:6.5|Famous Five Stand:3.8|East Stand:6.5|South Stand:3.5',
  'Tannadice Park': 'Jerry Kerr Stand:2|Eddie Thompson Stand:2.8|George Fox Stand:6|Fair Play Stand:3',
  'Dens Park': 'Main Stand:4|Bobby Cox Stand:3|Bob Shankly Stand:4|East End:0:o',
  'Rugby Park': 'Main Stand:3.5|Moffat Stand:4|East Stand:4|Chadwick Stand:3.5',
  'Fir Park': 'Main Stand:3|South Stand:4.5|Davie Cooper Stand:3|East Stand:3',
  'McDiarmid Park': 'Main Stand:3|North Stand:2.5|East Stand:2.5|Ormond Stand:2.5',
  'Somerset Park': 'Main Stand:1.5|Somerset Road End:3:t|Railway End:3:t|Enclosure:2.5:t',
  "Stark's Park": 'Main Stand:1.6|North Stand:3.5|Railway Stand:0:o|South Stand:3.7',
  'Cappielow Park': 'Main Stand:5|Sinclair Street End:2:t|Cowshed:3:t|Wee Dublin End:1.5:o',
  'Gayfield Park': 'Main Stand:0.9|Pavilion End:2:o|Seaside Terrace:2:o|Queen Street End:1.6:o',
  'Palmerston Park': 'East Stand:3.5|Terregles Street End:1.5:t|Portland Drive:2:t|Port Road End:1.5:o',
};
