// Geography data pools for non-country topics
// Each item: [name_uz, value, extra_uz]

export const RIVERS = [ // [name, length_km, continent_code]
  ["Nil",6650,"AF"], ["Amazonka",6400,"SA"], ["Yantszi",6300,"AS"],
  ["Missisipi",6275,"NA"], ["Yenisey",5539,"AS"], ["Xuanxe",5464,"AS"],
  ["Ob",5410,"AS"], ["Parana",4880,"SA"], ["Kongo",4700,"AF"],
  ["Amur",4444,"AS"], ["Lena",4400,"AS"], ["Mekong",4350,"AS"],
  ["Niger",4180,"AF"], ["Volga",3531,"EU"], ["Dunay",2860,"EU"],
  ["Sirdaryo",2212,"AS"], ["Amudaryo",2540,"AS"], ["Tigr",1950,"AS"],
  ["Frot",2780,"AS"], ["Indus",3180,"AS"], ["Gang",2525,"AS"],
];

export const MOUNTAINS = [ // [name, height_m, country_uz]
  ["Everest",8848,"Nepal/Xitoy"], ["K2",8611,"Pokiston"],
  ["Kanchenjunga",8586,"Nepal"], ["Lxotse",8516,"Nepal"],
  ["Makalu",8485,"Nepal"], ["Cho-Oyu",8188,"Nepal"],
  ["Dxaulagiri",8167,"Nepal"], ["Manaslu",8163,"Nepal"],
  ["Nanga-Parbat",8126,"Pokiston"], ["Annapurna",8091,"Nepal"],
  ["Akonkagua",6961,"Argentina"], ["Denali",6190,"AQSh"],
  ["Kilimanjaro",5895,"Tanzaniya"], ["Elbrus",5642,"Rossiya"],
  ["Monblan",4810,"Fransiya"], ["Kazbek",5033,"Gruziya"],
  ["Fudziyama",3776,"Yaponiya"], ["Kommunizm cho'qqisi",7495,"Tojikiston"],
  ["Pobeda cho'qqisi",7439,"Qirg'iziston"], ["Xon-Tangri",7010,"Qirg'iziston"],
];

export const SEAS = [ // [name, ocean_uz]
  ["Qora dengiz","Atlantika"], ["O'rta yer dengizi","Atlantika"],
  ["Boltiq dengizi","Atlantika"], ["Shimoliy dengiz","Atlantika"],
  ["Karib dengizi","Atlantika"], ["Qizil dengiz","Hind okeani"],
  ["Arab dengizi","Hind okeani"], ["Bengaliya qo'ltig'i","Hind okeani"],
  ["Yapon dengizi","Tinch okean"], ["Sariq dengiz","Tinch okean"],
  ["Sharqiy Xitoy dengizi","Tinch okean"], ["Janubiy Xitoy dengizi","Tinch okean"],
  ["Filippin dengizi","Tinch okean"], ["Bering dengizi","Tinch okean"],
  ["Oxota dengizi","Tinch okean"], ["Norvegiya dengizi","Atlantika"],
  ["Kaspiy dengizi","Yopiq"], ["Orol dengizi","Yopiq"],
];

export const LAKES = [ // [name, area_km2, country_uz]
  ["Kaspiy",371000,"Markaziy Osiyo"], ["Yuqori ko'l",82100,"AQSh/Kanada"],
  ["Viktoriya",69485,"Afrika"], ["Guron",59600,"AQSh/Kanada"],
  ["Michigan",58000,"AQSh"], ["Tanganika",32600,"Afrika"],
  ["Baykal",31722,"Rossiya"], ["Malavi",29500,"Afrika"],
  ["Bolshoy Medvejye",31000,"Kanada"], ["Erie",25700,"AQSh/Kanada"],
  ["Ontario",19000,"AQSh/Kanada"], ["Balxash",16400,"Qozog'iston"],
  ["Ladoga",17700,"Rossiya"], ["Issiq-ko'l",6236,"Qirg'iziston"],
  ["Titikaka",8372,"Peru/Boliviya"], ["Aydarko'l",4000,"O'zbekiston"],
];

export const DESERTS = [ // [name, continent_code, country_or_region]
  ["Sahroyi Kabir","AF","Shimoliy Afrika"], ["Arab","AS","Arabiston yarim oroli"],
  ["Gobi","AS","Mongoliya/Xitoy"], ["Patagoniya","SA","Argentina"],
  ["Atakama","SA","Chili"], ["Kalaxari","AF","Janubiy Afrika"],
  ["Namib","AF","Namibiya"], ["Taklamakan","AS","Xitoy"],
  ["Qizilqum","AS","O'zbekiston"], ["Qoraqum","AS","Turkmaniston"],
  ["Mojave","NA","AQSh"], ["Buyuk Viktoriya","OC","Avstraliya"],
  ["Tor","AS","Hindiston/Pokiston"], ["Sonora","NA","AQSh/Meksika"],
];

export const OCEANS = ["Tinch okean","Atlantika okeani","Hind okeani","Shimoliy Muz okeani","Janubiy okean"];

export const CONTINENTS_LIST = [
  ["Osiyo",44579000,"Eng katta materik"],
  ["Afrika",30370000,"Ikkinchi eng katta"],
  ["Shimoliy Amerika",24709000,""],
  ["Janubiy Amerika",17840000,""],
  ["Antarktida",14000000,"Sovuq materik"],
  ["Yevropa",10180000,""],
  ["Avstraliya",8600000,"Eng kichik materik"],
];

export const VOLCANOES = [ // name, country
  ["Etna","Italiya"], ["Vezuviy","Italiya"], ["Krakatau","Indoneziya"],
  ["Fudziyama","Yaponiya"], ["Kilimanjaro","Tanzaniya"],
  ["Popokatepetl","Meksika"], ["Mauna-Loa","AQSh"], ["Yelloustoun","AQSh"],
  ["Sent-Xelens","AQSh"], ["Tambora","Indoneziya"], ["Klyuchevskaya","Rossiya"],
];

export const ISLANDS = [ // name, area_km2
  ["Grenlandiya",2166086], ["Yangi Gvineya",785753], ["Kalimantan",748168],
  ["Madagaskar",587041], ["Baffin",507451], ["Sumatra",443066],
  ["Xonsyu",225800], ["Buyuk Britaniya",218595], ["Viktoriya",217291],
  ["Ellesmir",196236], ["Yava",138794], ["Kuba",105806],
  ["Islandiya",103000], ["Lyuzon",109965], ["Mindanao",97530],
  ["Irlandiya",84421], ["Hokkaydo",78073], ["Saxalin",72492],
];

export const CURRENCIES = [ // currency_uz, country_uz
  ["So'm","O'zbekiston"], ["Tenge","Qozog'iston"], ["Som","Qirg'iziston"],
  ["Somoni","Tojikiston"], ["Manat","Turkmaniston"], ["Rubl","Rossiya"],
  ["Yuan","Xitoy"], ["Iyena","Yaponiya"], ["Von","Janubiy Koreya"],
  ["Rupiya","Hindiston"], ["Dollar","AQSh"], ["Funt sterling","Buyuk Britaniya"],
  ["Yevro","Yevropa Ittifoqi"], ["Frank","Shveysariya"], ["Krona","Shvetsiya"],
  ["Lira","Turkiya"], ["Dinor","Iroq"], ["Real","Braziliya"],
  ["Peso","Meksika"], ["Rand","Janubiy Afrika"], ["Forint","Vengriya"],
  ["Zloti","Polsha"], ["Dram","Armaniston"], ["Lari","Gruziya"],
];
