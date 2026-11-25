// Ball Knower University question bank.
// Each line: Name | Position | Era (final college season) | Tier (1 easy, 2 medium, 3 hard) | Schools
// Schools: the answer first, then any other colleges he played at (never offered as wrong answers).
window.BKU_SCHOOLS = {
  SEC: ["Alabama","Arkansas","Auburn","Florida","Georgia","Kentucky","LSU","Ole Miss","Mississippi State","Missouri","Oklahoma","South Carolina","Tennessee","Texas","Texas A&M","Vanderbilt"],
  "Big Ten": ["Illinois","Indiana","Iowa","Maryland","Michigan","Michigan State","Minnesota","Nebraska","Northwestern","Ohio State","Oregon","Penn State","Purdue","Rutgers","UCLA","USC","Washington","Wisconsin"],
  "Big 12": ["Arizona","Arizona State","Baylor","BYU","Cincinnati","Colorado","Houston","Iowa State","Kansas","Kansas State","Oklahoma State","TCU","Texas Tech","UCF","Utah","West Virginia"],
  ACC: ["Boston College","California","Clemson","Duke","Florida State","Georgia Tech","Louisville","Miami","NC State","North Carolina","Pittsburgh","SMU","Stanford","Syracuse","Virginia","Virginia Tech","Wake Forest"],
  "Pac-12": ["Oregon State","Washington State"],
  Independent: ["Notre Dame","UConn"],
  "Group of 5": ["Boise State","Fresno State","Utah State","Nevada","UNLV","Hawaii","San Diego State","Wyoming","Colorado State","New Mexico","Memphis","East Carolina","Navy","Tulane","Marshall","Southern Miss","Troy","Louisiana Tech","Western Kentucky","Liberty","UTEP","Buffalo","Central Michigan","Eastern Michigan","Kent State","Toledo","Miami (OH)","Delaware"],
  Small: ["Jackson State","Mississippi Valley State","Alcorn State","Grambling State","Savannah State","Chattanooga","Eastern Washington","North Dakota State","South Dakota State","Northern Iowa","Idaho State","West Alabama","Western Colorado","Weber State","Montana","Montana State","Furman","Villanova"]
};
window.BKU_PLAYERS = `
Tim Tebow|QB|2000s|1|Florida
Cam Newton|QB|2010s|1|Auburn;Florida;Blinn College
Peyton Manning|QB|1990s|1|Tennessee
Eli Manning|QB|2000s|1|Ole Miss
Tom Brady|QB|1990s|1|Michigan
Joe Burrow|QB|2010s|1|LSU;Ohio State
Patrick Mahomes|QB|2010s|1|Texas Tech
Josh Allen|QB|2010s|1|Wyoming;Reedley College
Lamar Jackson|QB|2010s|1|Louisville
Baker Mayfield|QB|2010s|1|Oklahoma;Texas Tech
Kyler Murray|QB|2010s|1|Oklahoma;Texas A&M
Jalen Hurts|QB|2010s|1|Alabama;Oklahoma
Tua Tagovailoa|QB|2010s|1|Alabama
Trevor Lawrence|QB|2020s|1|Clemson
Deshaun Watson|QB|2010s|1|Clemson
Johnny Manziel|QB|2010s|1|Texas A&M
Robert Griffin III|QB|2010s|1|Baylor
Andrew Luck|QB|2010s|1|Stanford
Matt Leinart|QB|2000s|1|USC
Reggie Bush|RB|2000s|1|USC
Vince Young|QB|2000s|1|Texas
Derrick Henry|RB|2010s|1|Alabama
Mark Ingram|RB|2010s|1|Alabama
Adrian Peterson|RB|2000s|1|Oklahoma
Barry Sanders|RB|1980s|1|Oklahoma State
Bo Jackson|RB|1980s|1|Auburn
Herschel Walker|RB|1980s|1|Georgia
Emmitt Smith|RB|1980s|1|Florida
Ricky Williams|RB|1990s|1|Texas
Charles Woodson|CB|1990s|1|Michigan
Deion Sanders|CB|1980s|1|Florida State
Ndamukong Suh|DT|2000s|1|Nebraska
Calvin Johnson|WR|2000s|1|Georgia Tech
Julio Jones|WR|2010s|1|Alabama
Odell Beckham Jr.|WR|2010s|1|LSU
Ja'Marr Chase|WR|2010s|1|LSU
Justin Jefferson|WR|2010s|1|LSU
Ezekiel Elliott|RB|2010s|1|Ohio State
Saquon Barkley|RB|2010s|1|Penn State
Christian McCaffrey|RB|2010s|1|Stanford
J.J. Watt|DE|2010s|1|Wisconsin;Central Michigan
Aaron Rodgers|QB|2000s|1|California;Butte College
Russell Wilson|QB|2010s|1|Wisconsin;NC State
Drew Brees|QB|2000s|1|Purdue
Ray Lewis|LB|1990s|1|Miami
Michael Vick|QB|2000s|1|Virginia Tech
Randy Moss|WR|1990s|1|Marshall;Florida State;Notre Dame
Jameis Winston|QB|2010s|1|Florida State
Marcus Mariota|QB|2010s|1|Oregon
Bryce Young|QB|2020s|1|Alabama
Caleb Williams|QB|2020s|1|USC;Oklahoma
Jayden Daniels|QB|2020s|1|LSU;Arizona State
Travis Hunter|CB|2020s|1|Colorado;Jackson State
Shedeur Sanders|QB|2020s|1|Colorado;Jackson State
Bo Nix|QB|2020s|1|Oregon;Auburn
Michael Penix Jr.|QB|2020s|1|Washington;Indiana
C.J. Stroud|QB|2020s|1|Ohio State
Brian Bosworth|LB|1980s|1|Oklahoma
Doug Flutie|QB|1980s|1|Boston College
Troy Polamalu|S|2000s|1|USC
Larry Fitzgerald|WR|2000s|1|Pittsburgh
DeVonta Smith|WR|2020s|1|Alabama
Mac Jones|QB|2020s|1|Alabama
Justin Fields|QB|2020s|1|Ohio State;Georgia
Stetson Bennett|QB|2020s|1|Georgia;Jones College
Marvin Harrison Jr.|WR|2020s|1|Ohio State
Brock Purdy|QB|2020s|1|Iowa State
Bijan Robinson|RB|2020s|1|Texas
Ashton Jeanty|RB|2020s|1|Boise State
Aidan Hutchinson|DE|2020s|1|Michigan
Micah Parsons|LB|2010s|1|Penn State
T.J. Watt|LB|2010s|1|Wisconsin
Nick Bosa|DE|2010s|1|Ohio State
Chase Young|DE|2010s|1|Ohio State
Myles Garrett|DE|2010s|1|Texas A&M
Jadeveon Clowney|DE|2010s|1|South Carolina
Von Miller|LB|2010s|1|Texas A&M
Aaron Donald|DT|2010s|1|Pittsburgh
Tyrann Mathieu|CB|2010s|1|LSU
Travis Kelce|TE|2010s|1|Cincinnati
George Kittle|TE|2010s|1|Iowa
Rob Gronkowski|TE|2000s|1|Arizona
Davante Adams|WR|2010s|1|Fresno State
Tyreek Hill|WR|2010s|1|Oklahoma State;West Alabama;Garden City CC
Cooper Kupp|WR|2010s|1|Eastern Washington
DK Metcalf|WR|2010s|1|Ole Miss
CeeDee Lamb|WR|2010s|1|Oklahoma
Mike Evans|WR|2010s|1|Texas A&M
Alvin Kamara|RB|2010s|1|Tennessee;Alabama;Hutchinson CC
Todd Gurley|RB|2010s|1|Georgia
Le'Veon Bell|RB|2010s|1|Michigan State
Marshawn Lynch|RB|2000s|1|California
LaDainian Tomlinson|RB|2000s|1|TCU
Chris Johnson|RB|2000s|1|East Carolina
Jerry Rice|WR|1980s|1|Mississippi Valley State
Brett Favre|QB|1990s|1|Southern Miss
Dan Marino|QB|1980s|1|Pittsburgh
John Elway|QB|1980s|1|Stanford
Matthew Stafford|QB|2000s|1|Georgia
Matt Ryan|QB|2000s|1|Boston College
Dak Prescott|QB|2010s|1|Mississippi State
Justin Herbert|QB|2010s|1|Oregon
Sauce Gardner|CB|2020s|1|Cincinnati
Puka Nacua|WR|2020s|1|BYU;Washington
Jahmyr Gibbs|RB|2020s|1|Alabama;Georgia Tech
Will Anderson Jr.|LB|2020s|1|Alabama
Fernando Mendoza|QB|2020s|1|Indiana;California
Troy Smith|QB|2000s|2|Ohio State
Sam Bradford|QB|2000s|2|Oklahoma
Carson Palmer|QB|2000s|2|USC
Jason White|QB|2000s|2|Oklahoma
Charlie Ward|QB|1990s|2|Florida State
Danny Wuerffel|QB|1990s|2|Florida
Eddie George|RB|1990s|2|Ohio State
Ron Dayne|RB|1990s|2|Wisconsin
Desmond Howard|WR|1990s|2|Michigan
Marcus Allen|RB|1980s|2|USC
Eric Dickerson|RB|1980s|2|SMU
Thurman Thomas|RB|1980s|2|Oklahoma State
Marshall Faulk|RB|1990s|2|San Diego State
Jerome Bettis|RB|1990s|2|Notre Dame
Curtis Martin|RB|1990s|2|Pittsburgh
Warrick Dunn|RB|1990s|2|Florida State
Jamal Lewis|RB|1990s|2|Tennessee
Shaun Alexander|RB|1990s|2|Alabama
Ed Reed|S|2000s|2|Miami
Sean Taylor|S|2000s|2|Miami
Frank Gore|RB|2000s|2|Miami
Clinton Portis|RB|2000s|2|Miami
Edgerrin James|RB|1990s|2|Miami
Jamaal Charles|RB|2000s|2|Texas
Darren McFadden|RB|2000s|2|Arkansas
Arian Foster|RB|2000s|2|Tennessee
Maurice Jones-Drew|RB|2000s|2|UCLA
Steven Jackson|RB|2000s|2|Oregon State
Ray Rice|RB|2000s|2|Rutgers
Dalvin Cook|RB|2010s|2|Florida State
Leonard Fournette|RB|2010s|2|LSU
Jonathan Taylor|RB|2010s|2|Wisconsin
Nick Chubb|RB|2010s|2|Georgia
Josh Jacobs|RB|2010s|2|Alabama
Joe Mixon|RB|2010s|2|Oklahoma
Najee Harris|RB|2020s|2|Alabama
Travis Etienne|RB|2020s|2|Clemson
D'Andre Swift|RB|2010s|2|Georgia
Breece Hall|RB|2020s|2|Iowa State
Kenneth Walker III|RB|2020s|2|Michigan State;Wake Forest
De'Von Achane|RB|2020s|2|Texas A&M
Kareem Hunt|RB|2010s|2|Toledo
Aaron Jones|RB|2010s|2|UTEP
Tony Pollard|RB|2010s|2|Memphis
LaMichael James|RB|2010s|2|Oregon
Toby Gerhart|RB|2000s|2|Stanford
Montee Ball|RB|2010s|2|Wisconsin
Melvin Gordon|RB|2010s|2|Wisconsin
Ki-Jana Carter|RB|1990s|2|Penn State
Rashaan Salaam|RB|1990s|2|Colorado
Mike Alstott|FB|1990s|2|Purdue
Darren Sproles|RB|2000s|2|Kansas State
Philip Rivers|QB|2000s|2|NC State
Ben Roethlisberger|QB|2000s|2|Miami (OH)
Jared Goff|QB|2010s|2|California
Joe Flacco|QB|2000s|2|Delaware;Pittsburgh
Kirk Cousins|QB|2010s|2|Michigan State
Ryan Tannehill|QB|2010s|2|Texas A&M
Derek Carr|QB|2010s|2|Fresno State
Andy Dalton|QB|2010s|2|TCU
Colin Kaepernick|QB|2010s|2|Nevada
Case Keenum|QB|2010s|2|Houston
Kellen Moore|QB|2010s|2|Boise State
Colt McCoy|QB|2000s|2|Texas
Graham Harrell|QB|2000s|2|Texas Tech
Chase Daniel|QB|2000s|2|Missouri
Tim Couch|QB|1990s|2|Kentucky
Daunte Culpepper|QB|1990s|2|UCF
Chad Pennington|QB|1990s|2|Marshall
Byron Leftwich|QB|2000s|2|Marshall
Steve Young|QB|1980s|2|BYU
Troy Aikman|QB|1980s|2|UCLA;Oklahoma
Jim Kelly|QB|1980s|2|Miami
Vinny Testaverde|QB|1980s|2|Miami
Gino Torretta|QB|1990s|2|Miami
Ty Detmer|QB|1990s|2|BYU
Kerry Collins|QB|1990s|2|Penn State
Donovan McNabb|QB|1990s|2|Syracuse
Tommie Frazier|QB|1990s|2|Nebraska
Eric Crouch|QB|2000s|2|Nebraska
Jordan Love|QB|2010s|2|Utah State
Zach Wilson|QB|2020s|2|BYU
Trey Lance|QB|2020s|2|North Dakota State
Carson Wentz|QB|2010s|2|North Dakota State
Anthony Richardson|QB|2020s|2|Florida
Will Levis|QB|2020s|2|Kentucky;Penn State
Drake Maye|QB|2020s|2|North Carolina
J.J. McCarthy|QB|2020s|2|Michigan
Sam Howell|QB|2020s|2|North Carolina
Hendon Hooker|QB|2020s|2|Tennessee;Virginia Tech
Kenny Pickett|QB|2020s|2|Pittsburgh
Gardner Minshew|QB|2010s|2|Washington State;East Carolina;Troy;Northwest Mississippi CC
Jalen Milroe|QB|2020s|2|Alabama
Quinn Ewers|QB|2020s|2|Texas;Ohio State
Dillon Gabriel|QB|2020s|2|Oregon;UCF;Oklahoma
Cam Ward|QB|2020s|2|Miami;Washington State;Incarnate Word
Carson Beck|QB|2020s|2|Georgia;Miami
Jaxson Dart|QB|2020s|2|Ole Miss;USC
Sam Darnold|QB|2010s|2|USC
Josh Rosen|QB|2010s|2|UCLA
Daniel Jones|QB|2010s|2|Duke
Dwayne Haskins|QB|2010s|2|Ohio State
Jake Fromm|QB|2010s|2|Georgia
Mason Rudolph|QB|2010s|2|Oklahoma State
Max Duggan|QB|2020s|2|TCU
Malik Willis|QB|2020s|2|Liberty;Auburn
Desmond Ridder|QB|2020s|2|Cincinnati
Mark Sanchez|QB|2000s|2|USC
Jake Locker|QB|2010s|2|Washington
Pat White|QB|2000s|2|West Virginia
Dennis Dixon|QB|2000s|2|Oregon
Brady Quinn|QB|2000s|2|Notre Dame
JaMarcus Russell|QB|2000s|2|LSU
Ken Dorsey|QB|2000s|2|Miami
Rex Grossman|QB|2000s|2|Florida
Chris Weinke|QB|2000s|2|Florida State
Colt Brennan|QB|2000s|2|Hawaii;Colorado;Saddleback College
Terrelle Pryor|QB|2010s|2|Ohio State
Denard Robinson|QB|2010s|2|Michigan
Taysom Hill|QB|2010s|2|BYU;Stanford
Connor Cook|QB|2010s|2|Michigan State
Lawrence Taylor|LB|1980s|2|North Carolina
Reggie White|DE|1980s|2|Tennessee
Bruce Smith|DE|1980s|2|Virginia Tech
Derrick Thomas|LB|1980s|2|Alabama
Junior Seau|LB|1980s|2|USC
Brian Urlacher|LB|1990s|2|New Mexico
Champ Bailey|CB|1990s|2|Georgia
Julius Peppers|DE|2000s|2|North Carolina
Mario Williams|DE|2000s|2|NC State
Earl Thomas|S|2000s|2|Texas
Richard Sherman|CB|2010s|2|Stanford
Patrick Willis|LB|2000s|2|Ole Miss
Clay Matthews|LB|2000s|2|USC
Terrell Suggs|DE|2000s|2|Arizona State
DeMarcus Ware|DE|2000s|2|Troy
Jevon Kearse|DE|1990s|2|Florida
Dwight Freeney|DE|2000s|2|Syracuse
Ronnie Lott|S|1980s|2|USC
Derrick Brooks|LB|1990s|2|Florida State
Warren Sapp|DT|1990s|2|Miami
Joey Bosa|DE|2010s|2|Ohio State
Jalen Carter|DT|2020s|2|Georgia
Travon Walker|DE|2020s|2|Georgia
Kayvon Thibodeaux|DE|2020s|2|Oregon
Patrick Surtain II|CB|2020s|2|Alabama
Minkah Fitzpatrick|S|2010s|2|Alabama
Jamal Adams|S|2010s|2|LSU
Devin White|LB|2010s|2|LSU
Roquan Smith|LB|2010s|2|Georgia
Patrick Peterson|CB|2010s|2|LSU
Jalen Ramsey|CB|2010s|2|Florida State
Derwin James|S|2010s|2|Florida State
Luke Kuechly|LB|2010s|2|Boston College
Manti Te'o|LB|2010s|2|Notre Dame
Khalil Mack|LB|2010s|2|Buffalo
Bobby Wagner|LB|2010s|2|Utah State
Fred Warner|LB|2010s|2|BYU
Maxx Crosby|DE|2010s|2|Eastern Michigan
Darrelle Revis|CB|2000s|2|Pittsburgh
Brian Dawkins|S|1990s|2|Clemson
Michael Irvin|WR|1980s|2|Miami
Tim Brown|WR|1980s|2|Notre Dame
Andre Johnson|WR|2000s|2|Miami
Reggie Wayne|WR|2000s|2|Miami
Santana Moss|WR|2000s|2|Miami
Terrell Owens|WR|1990s|2|Chattanooga
Marvin Harrison|WR|1990s|2|Syracuse
Torry Holt|WR|1990s|2|NC State
Steve Smith Sr.|WR|2000s|2|Utah
Hines Ward|WR|1990s|2|Georgia
Wes Welker|WR|2000s|2|Texas Tech
Julian Edelman|WR|2000s|2|Kent State
Antonio Brown|WR|2000s|2|Central Michigan
A.J. Green|WR|2010s|2|Georgia
Dez Bryant|WR|2000s|2|Oklahoma State
Demaryius Thomas|WR|2000s|2|Georgia Tech
Michael Crabtree|WR|2000s|2|Texas Tech
Justin Blackmon|WR|2010s|2|Oklahoma State
Tavon Austin|WR|2010s|2|West Virginia
Sammy Watkins|WR|2010s|2|Clemson
DeAndre Hopkins|WR|2010s|2|Clemson
Amari Cooper|WR|2010s|2|Alabama
Jerry Jeudy|WR|2010s|2|Alabama
Jaylen Waddle|WR|2020s|2|Alabama
Calvin Ridley|WR|2010s|2|Alabama
Stefon Diggs|WR|2010s|2|Maryland
A.J. Brown|WR|2010s|2|Ole Miss
Tee Higgins|WR|2010s|2|Clemson
Deebo Samuel|WR|2010s|2|South Carolina
Tyler Lockett|WR|2010s|2|Kansas State
Jordy Nelson|WR|2000s|2|Kansas State
Golden Tate|WR|2000s|2|Notre Dame
Garrett Wilson|WR|2020s|2|Ohio State
Jaxon Smith-Njigba|WR|2020s|2|Ohio State
Chris Olave|WR|2020s|2|Ohio State
Terry McLaurin|WR|2010s|2|Ohio State
Malik Nabers|WR|2020s|2|LSU
Brian Thomas Jr.|WR|2020s|2|LSU
Rome Odunze|WR|2020s|2|Washington
Drake London|WR|2020s|2|USC
Jordan Addison|WR|2020s|2|USC;Pittsburgh
Jameson Williams|WR|2020s|2|Alabama;Ohio State
Rashee Rice|WR|2020s|2|SMU
Zay Flowers|WR|2020s|2|Boston College
Nico Collins|WR|2010s|2|Michigan
Ladd McConkey|WR|2020s|2|Georgia
Xavier Worthy|WR|2020s|2|Texas
Tetairoa McMillan|WR|2020s|2|Arizona
Keon Coleman|WR|2020s|2|Florida State;Michigan State
Brock Bowers|TE|2020s|2|Georgia
Kyle Pitts|TE|2020s|2|Florida
Tony Gonzalez|TE|1990s|2|California
Jason Witten|TE|2000s|2|Tennessee
Antonio Gates|TE|2000s|2|Kent State
Jimmy Graham|TE|2000s|2|Miami
Greg Olsen|TE|2000s|2|Miami;Notre Dame
Mark Andrews|TE|2010s|2|Oklahoma
Sam LaPorta|TE|2020s|2|Iowa
T.J. Hockenson|TE|2010s|2|Iowa
Dallas Clark|TE|2000s|2|Iowa
Zach Ertz|TE|2010s|2|Stanford
Trey McBride|TE|2020s|2|Colorado State
Tyler Warren|TE|2020s|2|Penn State
Randall Cunningham|QB|1980s|3|UNLV
Boomer Esiason|QB|1980s|3|Maryland
Jeff George|QB|1980s|3|Illinois;Purdue
Bernie Kosar|QB|1980s|3|Miami
Steve McNair|QB|1990s|3|Alcorn State
Kordell Stewart|QB|1990s|3|Colorado
Rick Mirer|QB|1990s|3|Notre Dame
Heath Shuler|QB|1990s|3|Tennessee
Jim Harbaugh|QB|1980s|3|Michigan
Rich Gannon|QB|1980s|3|Delaware
Kurt Warner|QB|1990s|3|Northern Iowa
Mark Brunell|QB|1990s|3|Washington
Trent Dilfer|QB|1990s|3|Fresno State
Jake Plummer|QB|1990s|3|Arizona State
Drew Bledsoe|QB|1990s|3|Washington State
Akili Smith|QB|1990s|3|Oregon
Cade McNown|QB|1990s|3|UCLA
Josh Heupel|QB|2000s|3|Oklahoma;Weber State;Snow College
Andre Ware|QB|1980s|3|Houston
Christian Ponder|QB|2010s|3|Florida State
Blaine Gabbert|QB|2010s|3|Missouri
Everett Golson|QB|2010s|3|Notre Dame;Florida State
Bailey Zappe|QB|2020s|3|Western Kentucky;Houston Baptist
Spencer Rattler|QB|2020s|3|South Carolina;Oklahoma
Kyle McCord|QB|2020s|3|Syracuse;Ohio State
Mike Singletary|LB|1980s|3|Baylor
Hugh Green|DE|1980s|3|Pittsburgh
Tedy Bruschi|DE|1990s|3|Arizona
Zach Thomas|LB|1990s|3|Texas Tech
Jared Allen|DE|2000s|3|Idaho State
Rod Woodson|CB|1980s|3|Purdue
Jonathan Vilma|LB|2000s|3|Miami
Lavonte David|LB|2010s|3|Nebraska;Fort Scott CC
Leighton Vander Esch|LB|2010s|3|Boise State
Danielle Hunter|DE|2010s|3|LSU
Cooper DeJean|CB|2020s|3|Iowa
Isaac Bruce|WR|1990s|3|Memphis;Santa Monica College
Chad Johnson|WR|2000s|3|Oregon State;Santa Monica College
Shannon Sharpe|TE|1980s|3|Savannah State
Kellen Winslow II|TE|2000s|3|Miami
Hunter Henry|TE|2010s|3|Arkansas
Evan Engram|TE|2010s|3|Ole Miss
Dallas Goedert|TE|2010s|3|South Dakota State
Dalton Kincaid|TE|2020s|3|Utah;San Diego
Colston Loveland|TE|2020s|3|Michigan
Brandon Marshall|WR|2000s|3|UCF
Kevin White|WR|2010s|3|West Virginia
Michael Floyd|WR|2010s|3|Notre Dame
Jeremy Maclin|WR|2000s|3|Missouri
Kadarius Toney|WR|2020s|3|Florida
Jahan Dotson|WR|2020s|3|Penn State
Adonai Mitchell|WR|2020s|3|Texas;Georgia
Priest Holmes|RB|1990s|3|Texas
Garrison Hearst|RB|1990s|3|Georgia
Donald Brown|RB|2000s|3|UConn
Kevin Smith|RB|2000s|3|UCF
Austin Ekeler|RB|2010s|3|Western Colorado
Isiah Pacheco|RB|2020s|3|Rutgers
Rachaad White|RB|2020s|3|Arizona State;Mt. San Antonio College
Kyren Williams|RB|2020s|3|Notre Dame
James Cook|RB|2020s|3|Georgia
Orlando Pace|OT|1990s|3|Ohio State
Jonathan Ogden|OT|1990s|3|UCLA
Joe Thomas|OT|2000s|3|Wisconsin
Quenton Nelson|OG|2010s|3|Notre Dame
Zack Martin|OG|2010s|3|Notre Dame
Tyron Smith|OT|2010s|3|USC
Trent Williams|OT|2000s|3|Oklahoma
Penei Sewell|OT|2010s|3|Oregon
Andrew Whitworth|OT|2000s|3|LSU
Jason Kelce|C|2010s|3|Cincinnati
Tony Boselli|OT|1990s|3|USC
Walter Jones|OT|1990s|3|Florida State
Joe Alt|OT|2020s|3|Notre Dame
Rashawn Slater|OT|2010s|3|Northwestern
Peter Skoronski|OT|2020s|3|Northwestern
`;
