/**
 * Press-and-hold explanations. Spread `hp('key')` onto an element and holding
 * it shows the text (see HelpLayer).
 */
const HELP = {
  // ---------------------------------------------------------------- navigation
  navHub: ['Hub', 'Your home screen: the next match, the board and fans, anything that needs your attention, and the league table.'],
  navSquad: ['Squad', 'Your players: ratings, fitness, morale and roles, plus the Training and Medical screens.'],
  navTactics: ['Tactics', 'Pick the formation, how attacking to be, how hard to press, and choose the starting XI and bench.'],
  navTransfers: ['Transfers', 'Search every player in the game, send scouts, deal with offers for your players and see the deals done.'],
  navClub: ['Club', "The chairman's office: the ground, staff and facilities, money, the board, and your trophy cabinet."],
  inbox: ['Inbox', 'Messages from your staff, the board and other clubs: scout reports, bids, injuries and news. Unread ones are counted on the badge.'],
  date: ['Date', 'Today in the game. Each press of Continue moves on half a day (morning, then afternoon). League matches are on Saturdays.'],
  continue: ['Continue', 'Move on half a day. On matchday it takes you to the match instead. Nothing happens until you press it, so take your time.'],

  // ---------------------------------------------------------------- hub
  bank: ['Bank balance', 'Cash the club has right now. Below zero and the board gets very nervous. Spend it on players, the ground and facilities.'],
  board: ['Board confidence', "How happy the board is with you (0–100). It rises with wins and hitting the season target, and falls with defeats and money trouble. On hard, too low and you're sacked."],
  fans: ['Fan happiness', 'How happy the supporters are (0–100). Happy fans come in bigger numbers and buy more. Results, ticket prices and a better ground all matter.'],
  target: ['Season target', "What the board expects this season. Hit it and confidence rises; miss it badly and they'll question you."],
  playMatch: ['Play match', 'Go to the team sheet, then watch the game live with commentary. Make substitutions, change tactics and give a half-time team talk.'],
  simMatch: ['Sim match', "Plays the full 90 minutes instantly with your current team and tactics, and shows the result. Your assistant rests anyone who's tired."],
  simSeason: ['Sim to the end of the season', 'Plays every remaining match instantly. Your assistant picks the team. Handy for testing; you miss the chance to react.'],
  gradingAlert: ['Ground rules', "Each league needs a minimum capacity, number of seats and floodlights. If your ground falls short you can't be promoted, even as champions."],

  // ---------------------------------------------------------------- players
  ovr: ['Ability', "The player's current rating out of 100. A range like 52–60 means your scouts haven't watched him yet."],
  potential: ['Potential', 'How much better he could become, in stars. Five stars: could improve a lot. Young players with game time and good coaching grow fastest.'],
  position: ['Position', 'Where he plays best. Other positions he can play are listed after a slash. Out of position he performs worse.'],
  fitness: ['Fitness', 'How fresh he is (0–100%). Matches tire players; they recover a bit each day. Tired players play worse and get injured more.'],
  morale: ['Morale', 'How happy he is (0–100). Playing time, results and his role matter. Happy players play better; unhappy ones may ask to leave.'],
  form: ['Form', 'His average match rating from recent games (out of 10). 7+ is good.'],
  value: ['Value', "What he's worth on the market. Ability, age and potential decide it. Clubs usually ask a bit more if he's important to them."],
  wage: ['Wage', 'What he earns per week. Wages count against your wage budget every week.'],
  contract: ['Contract', 'When his deal runs out. If it ends and you haven’t renewed it, he leaves for nothing.'],
  interest: ['Interest', "Would he join you? Keen and Open: yes at a normal wage. Reluctant: he'll want more. Big wage: he'd only drop to your level for a lot of money."],
  role: ['Squad role', 'What you promise him. Key players expect to play almost every game; backups and prospects are fine with less. Break the promise and he gets unhappy.'],
  shortlist: ['Shortlist', 'Star a player to keep an eye on him. Your shortlist is in Transfers → Scouting.'],
  scoutPlayer: ['Send a scout', 'A scout watches him for a few days and reports back with his exact ability, potential, and whether he would suit you and join you.'],
  listed: ['Transfer list', 'Put him up for sale. Other clubs are more likely to bid, and for a little less.'],
  seasonStats: ['This season', 'Games played, goals and assists this season, for every club he has played for.'],
  careerStats: ['Career', 'Games played, goals and assists across his whole career, including this season.'],
  cleanSheets: ['Clean sheets', "Games where he started in goal and his side didn't concede. The keeper with the most in each league, cup and European competition wins its Golden Glove."],
  navManager: ['Manager', 'Your own career: your record, best XI, transfer dealings, clubs managed, the trophy room, and job offers from other clubs.'],
  managerRecord: ['Your record', 'Every competitive game you have managed, at every club: wins, draws, defeats and goals.'],
  preferredTactic: ['Preferred tactic', 'The formation and mentality you have used most.'],
  feesOut: ['Fees out', 'Every transfer fee you have paid, across all your clubs.'],
  feesIn: ['Fees in', 'Every transfer fee you have received for players you sold.'],
  biggestSigning: ['Highest fee paid', 'Your most expensive signing.'],
  cheapestSigning: ['Lowest fee paid', 'The cheapest signing you paid a fee for (free transfers are counted separately).'],
  bestXI: ['Best XI', 'The best team of players you have managed, by the best rating each reached while playing for you (10 games or more).'],
  release: ['Release', 'Cancel his contract. You pay half the wages left on his deal as a pay-off.'],
  renew: ['Renew contract', 'Offer him a new deal before his contract runs out. He tells you the wage he wants.'],
  offer: ['Make an offer', 'Bid a transfer fee to his club. They accept, counter or reject. If they accept, you then agree his wage.'],
  loan: ['Loan', 'Borrow him until the end of the season. You pay his wages, no fee. Clubs only lend players outside their first team.'],

  // ---------------------------------------------------------------- squad
  restTired: ['Rest tired players', 'Swap any starter whose fitness is low for a fresh player in the same position.'],
  autoRotate: ['Auto-rotate', 'Your assistant rests tired players before every match, even ones you play yourself.'],
  training: ['Training', 'Set what the squad works on each week, how hard they train, and individual plans like retraining a player in a new position.'],
  medical: ['Medical', "Who's injured and for how long, who's tired, and the injury history. A better physio shortens injuries."],

  // ---------------------------------------------------------------- tactics
  formation: ['Formation', 'How your 11 players line up. Pick one that suits your best players: the auto-pick fills each slot with the best fit.'],
  mentality: ['Mentality', 'How much to attack. Attacking scores more but leaves gaps at the back; defensive is the opposite.'],
  pressing: ['Pressing', 'How hard to win the ball back. High pressing wins the ball higher up but tires players faster.'],
  bench: ['Substitutes', 'The players on the bench for matches. Untouched slots are filled with the best of the rest.'],

  // ---------------------------------------------------------------- transfers
  transferBudget: ['Budgets', "What the board lets you spend: a transfer budget for fees and a wage budget for weekly wages. The wage budget is set so your weekly TV and shop money covers it, so you're in the green every week even at the limit. Tap to move money between them (going past it can mean losing money)."],
  realistic: ['Realistic targets', "Only show players you could afford: the fee within your transfer budget and wages you could fit in."],
  scoutingTab: ['Scouting', 'Send scouts on missions to find players, read their reports, and keep a shortlist.'],
  scoutMission: ['Scouting mission', 'Tell the scouts what you need. In about a week they come back with reports on the best players who fit and would consider joining. Uses one of the week’s scout reports.'],
  chiefScout: ['Chief scout', 'A better chief scout gives you more reports each week, brings them back sooner, and judges ability more accurately.'],

  // ---------------------------------------------------------------- club: ground
  capacity: ['Capacity', 'How many fans the ground holds. A stand being built holds half its fans until the work is finished.'],
  seats: ['Seats', 'How many of the places are seats. Seats sell for a quarter more than terracing, and higher leagues need a minimum number.'],
  floodlights: ['Floodlights', 'Needed to play in most leagues above the bottom level. Without them you cannot be promoted.'],
  stand: ['Stand', 'Tap to extend it, seat it or put a roof on. Each option shows the cost, build time and extra weekly upkeep.'],
  grading: ['Ground rules', "What the next league up demands of your ground. All three must pass, with the building work finished, by the end of the season or you can't go up."],
  food: ['Food and drink', 'Fans buy food and drink at every home game. Better outlets mean they spend more per head. Each level has a build cost and a weekly running cost.'],
  vip: ['VIP hospitality', 'Places sold to businesses and well-off fans at every home game. Each level adds more places; the bigger ones need a bigger ground.'],
  openSide: ['Open side', "No stand yet: fans stand behind the rail round the pitch, like most grounds at the bottom of the pyramid. Tap to build a seated stand or put up a covered terrace."],
  corner: ['Corner', 'Fill in a corner between two stands. Corners are smaller than the sides (up to 7,500) but join the ground into a bowl, which the fans love. New places are always seated.'],
  corporate: ['Corporate rooms', 'Meeting rooms, conference halls and banqueting suites hired out every day of the week, match or not. Bigger clubs pull bigger events.'],
  groundExtras: ['Ground improvements', 'Floodlights, a full roof over every stand, and undersoil heating so the pitch never freezes (fewer injuries, happier fans).'],
  fanVerdict: ["Fans' verdict", 'What the supporters make of the ground: roofs, seats, corners, food, prices, heating and how full it is. Happy fans mean bigger crowds.'],
  groundUpkeep: ['Running costs', 'Paid every week, home game or not: stewarding, repairs, the pitch, power, and running your food outlets and hospitality.'],

  // ---------------------------------------------------------------- club: staff
  staffRating: ['Staff rating', 'How good they are, out of 20. 15+ is excellent, 11+ good, 6–10 average, 5 or less poor. Better staff cost more.'],
  facility: ['Facilities', 'Training ground: players improve faster. Youth academy: better youngsters each year. Medical centre: fewer and shorter injuries. Each level costs more to run.'],

  trainingPart: ['Training ground', 'Gym, sports science, rehab, all-weather pitches and video analysis. Each one helps the squad in its own way, and costs a little each week to run.'],
  playerVerdict: ["Players' verdict", 'What the squad thinks of the training set-up, judged against what clubs at your level usually have. It nudges morale every month.'],

  // ---------------------------------------------------------------- club: money
  weekly: ['A normal week', 'What comes in and goes out every week, with no home game. Home games add the gate, food and hospitality on top.'],
  homeGame: ['Each home game', "Takings from one home league game at today's prices. Season-ticket holders have already paid, so only the others pay on the gate."],
  seasonTickets: ['Season tickets', 'Sold every summer at a fifth off and paid up front. More fans, better results and a bigger ground sell more.'],
  ticketPrice: ['Ticket price', 'What fans pay on the gate. Higher prices bring in more per fan, but fewer come and the fans grumble above the going rate.'],
  sponsor: ['Shirt sponsor', 'Choose a deal each summer: steady weekly money, a lump sum now, or less each week with a bonus if you go up.'],
  loanBank: ['Bank loan', 'Borrow money now and pay it back weekly over two seasons, with 8% interest. Useful for ground work.'],
  ledger: ['This season so far', 'Every pound in and out since the season started.'],
  editor: ['Game editor', "Set the club's reputation, wage budget, transfer budget and bank balance yourself."],
} as const;

export type HelpKey = keyof typeof HELP;

/** Props that make an element explain itself when pressed and held. */
export function hp(key: HelpKey): { 'data-help': string; 'data-help-title': string } {
  const [title, text] = HELP[key];
  return { 'data-help': text, 'data-help-title': title };
}
