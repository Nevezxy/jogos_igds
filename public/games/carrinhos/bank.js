// public/games/carrinhos/bank.js
// Banco de fases do 🚗 Carrinhos, gerado por scripts/carrinhos-banco.js
// (não edite à mão). Cada fase: o estacionamento (36 letras, linha a linha)
// e o mínimo de jogadas, calculado por busca em largura.

(function (root) {
  const BANK = [
    ['.........BBCAA...C.......DD......EE.', 2],
    ['.......CC.EEAAD.....D..........BBB..', 2],
    ['DD.......C.BAA.C.B.EE.FF............', 3],
    ['.......BB.CCAAD.....D....EE....FFF..', 3],
    ['.B.....BD.ECAAD.EC..................', 4],
    ['.D.....DF.BCAAF.BC...EEE............', 4],
    ['.CC....DDH..AABH..E.B.GGE.F...E.F...', 5],
    ['....BB.CCCDEAA..DE....D.F.GGG.F..HH.', 5],
    ['...FBBDD.FC.EGAAC.EG..H.E...H....II.', 6],
    ['...I...D.IFFBDAAE.B...E.B...C.HHGGC.', 6],
    ['..BBC....ECDAA.ECD.FFGG.............', 7],
    ['.CC.FE..BDFEAABDJE.GH.J..GHI.....IKK', 8],
    ['BBB..E..CDDEAAC...FF.GHHIIIG...JJGKK', 8],
    ['CCCG.DBEEGHDBAAGHDFII...FJJJ........', 9],
    ['CCCG.DBEEGHDBAAGHDF.II..FJJJ..KKK...', 10],
    ['IFBBBDIFEECDAAH.CD..H.G..JJ.G...KKLL', 10],
    ['....BJ....BJEAA.BFECHDDF.CHG...C.GII', 11],
    ['.E.BBB.EG.CDAAG.CDH...FDHII.F..JJKK.', 12],
    ['.BB.C..DDDC.AA.EC.FHHE..F.GIII..GJJJ', 13],
    ['BB..H.EEFFH.AA..HJDIGGGJDI.C..D..CKK', 14],
    ['CCK...EEK.DFAA..DFJBGGDIJB.H.I.B.HLL', 15],
    ['BBDDJHFFGGJHAA..JLEKIIILEK.C..E..CMM', 15],
    ['.BBCC...HIEEAAHI..DGHJJ.DG..FKDGLLFK', 16],
    ['.BBCC...GHDDAAGH.J.FGIIJ.F..E..FKKE.', 17],
    ['HBBCCCHDDEFGAA.EFG..IJJJ..I..KLLI..K', 18],
    ['BCCDDDBEEFGHAAIFGH..IJJJ..I..KLL...K', 19],
    ['CCBF..H.BFEEH.AAGD....GDIIJJJD....KK', 20],
    ['CCBF..H.BFEEH.AAGD....GDIIJJJD..KKLL', 21],
    ['BBB..DFGEEEDFGAA.LJIIC.LJ.HCKK..HMMM', 22],
    ['BBCC.DG..I.DGAAIEDJJH.E..FHKK..FLLMM', 23],
    ['..BCCCD.B.FGDAAEFGKHHEIIKLLL.JMMNNNJ', 24],
    ['CC.BEJ...BEJAA.BI.FGG.I.F.DHHHKKD.LL', 25],
    ['CC.BEF...BEFAA.BJKGHH.JKG.DIIILLD.MM', 26],
    ['BB..F.DDD.FCAAE.FC..E.GGIJJJ.HIKKLLH', 27],
    ['.BBDD...CLFFAACL.EGIKJJEGIK.MHGNN.MH', 28],
    ['GBB.C.GDDDC.AAHFC...HFII.JJJ.EKKK..E', 29],
    ['BB.J..E..JGGEFAAHDEFIIHDLLC..KMMCNNK', 30],
    ['BBBCCD..LFFDAALJGHEIIJGHE...KK.MMNNN', 31],
    ['BBBCCD..LFFDAALJGHEIIJGHE...KKMM..NN', 32],
    ['GBBBDEGFFFDEAAH.D.J.HCIIJKKC.L.MMM.L', 34],
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = BANK;
  else root.CarrinhosBank = BANK;
})(typeof window !== 'undefined' ? window : globalThis);
