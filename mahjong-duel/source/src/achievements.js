import { PAIRS_PER_DUEL, PAIRS_TO_WIN } from './game-balance.js';

// Keep the original IDs, conditions and rewards as the migration source.
const LEGACY_ACHIEVEMENTS = Object.freeze([
  {
    "id": "A001",
    "name": "Complete 1 Duel",
    "category": "Completed duels",
    "description": "Complete 1 duel by clearing all 40 pairs; wins, losses and draws count.",
    "counterKey": "completedDuels",
    "target": 1,
    "points": 5
  },
  {
    "id": "A002",
    "name": "Complete 5 Duels",
    "category": "Completed duels",
    "description": "Complete 5 duels by clearing all 40 pairs; wins, losses and draws count.",
    "counterKey": "completedDuels",
    "target": 5,
    "points": 5
  },
  {
    "id": "A003",
    "name": "Complete 10 Duels",
    "category": "Completed duels",
    "description": "Complete 10 duels by clearing all 40 pairs; wins, losses and draws count.",
    "counterKey": "completedDuels",
    "target": 10,
    "points": 5
  },
  {
    "id": "A004",
    "name": "Complete 25 Duels",
    "category": "Completed duels",
    "description": "Complete 25 duels by clearing all 40 pairs; wins, losses and draws count.",
    "counterKey": "completedDuels",
    "target": 25,
    "points": 10
  },
  {
    "id": "A005",
    "name": "Complete 50 Duels",
    "category": "Completed duels",
    "description": "Complete 50 duels by clearing all 40 pairs; wins, losses and draws count.",
    "counterKey": "completedDuels",
    "target": 50,
    "points": 10
  },
  {
    "id": "A006",
    "name": "Complete 100 Duels",
    "category": "Completed duels",
    "description": "Complete 100 duels by clearing all 40 pairs; wins, losses and draws count.",
    "counterKey": "completedDuels",
    "target": 100,
    "points": 15
  },
  {
    "id": "A007",
    "name": "Complete 200 Duels",
    "category": "Completed duels",
    "description": "Complete 200 duels by clearing all 40 pairs; wins, losses and draws count.",
    "counterKey": "completedDuels",
    "target": 200,
    "points": 15
  },
  {
    "id": "A008",
    "name": "Complete 300 Duels",
    "category": "Completed duels",
    "description": "Complete 300 duels by clearing all 40 pairs; wins, losses and draws count.",
    "counterKey": "completedDuels",
    "target": 300,
    "points": 20
  },
  {
    "id": "A009",
    "name": "Complete 500 Duels",
    "category": "Completed duels",
    "description": "Complete 500 duels by clearing all 40 pairs; wins, losses and draws count.",
    "counterKey": "completedDuels",
    "target": 500,
    "points": 25
  },
  {
    "id": "A010",
    "name": "Complete 1,000 Duels",
    "category": "Completed duels",
    "description": "Complete 1,000 duels by clearing all 40 pairs; wins, losses and draws count.",
    "counterKey": "completedDuels",
    "target": 1000,
    "points": 30
  },
  {
    "id": "A011",
    "name": "Win 1 Duel",
    "category": "Wins",
    "description": "Win 1 completed duel against a player; abandoned boards do not count.",
    "counterKey": "completedWins",
    "target": 1,
    "points": 5
  },
  {
    "id": "A012",
    "name": "Win 5 Duels",
    "category": "Wins",
    "description": "Win 5 completed duels against a player; abandoned boards do not count.",
    "counterKey": "completedWins",
    "target": 5,
    "points": 5
  },
  {
    "id": "A013",
    "name": "Win 10 Duels",
    "category": "Wins",
    "description": "Win 10 completed duels against a player; abandoned boards do not count.",
    "counterKey": "completedWins",
    "target": 10,
    "points": 10
  },
  {
    "id": "A014",
    "name": "Win 25 Duels",
    "category": "Wins",
    "description": "Win 25 completed duels against a player; abandoned boards do not count.",
    "counterKey": "completedWins",
    "target": 25,
    "points": 10
  },
  {
    "id": "A015",
    "name": "Win 50 Duels",
    "category": "Wins",
    "description": "Win 50 completed duels against a player; abandoned boards do not count.",
    "counterKey": "completedWins",
    "target": 50,
    "points": 15
  },
  {
    "id": "A016",
    "name": "Win 100 Duels",
    "category": "Wins",
    "description": "Win 100 completed duels against a player; abandoned boards do not count.",
    "counterKey": "completedWins",
    "target": 100,
    "points": 15
  },
  {
    "id": "A017",
    "name": "Win 150 Duels",
    "category": "Wins",
    "description": "Win 150 completed duels against a player; abandoned boards do not count.",
    "counterKey": "completedWins",
    "target": 150,
    "points": 20
  },
  {
    "id": "A018",
    "name": "Win 250 Duels",
    "category": "Wins",
    "description": "Win 250 completed duels against a player; abandoned boards do not count.",
    "counterKey": "completedWins",
    "target": 250,
    "points": 25
  },
  {
    "id": "A019",
    "name": "Win 500 Duels",
    "category": "Wins",
    "description": "Win 500 completed duels against a player; abandoned boards do not count.",
    "counterKey": "completedWins",
    "target": 500,
    "points": 30
  },
  {
    "id": "A020",
    "name": "Win 1,000 Duels",
    "category": "Wins",
    "description": "Win 1,000 completed duels against a player; abandoned boards do not count.",
    "counterKey": "completedWins",
    "target": 1000,
    "points": 40
  },
  {
    "id": "A021",
    "name": "Match 10 Pairs",
    "category": "Pairs",
    "description": "Personally match 10 pairs across all duels, including pairs matched before leaving.",
    "counterKey": "personalPairs",
    "target": 10,
    "points": 5
  },
  {
    "id": "A022",
    "name": "Match 50 Pairs",
    "category": "Pairs",
    "description": "Personally match 50 pairs across all duels, including pairs matched before leaving.",
    "counterKey": "personalPairs",
    "target": 50,
    "points": 5
  },
  {
    "id": "A023",
    "name": "Match 100 Pairs",
    "category": "Pairs",
    "description": "Personally match 100 pairs across all duels, including pairs matched before leaving.",
    "counterKey": "personalPairs",
    "target": 100,
    "points": 5
  },
  {
    "id": "A024",
    "name": "Match 250 Pairs",
    "category": "Pairs",
    "description": "Personally match 250 pairs across all duels, including pairs matched before leaving.",
    "counterKey": "personalPairs",
    "target": 250,
    "points": 10
  },
  {
    "id": "A025",
    "name": "Match 500 Pairs",
    "category": "Pairs",
    "description": "Personally match 500 pairs across all duels, including pairs matched before leaving.",
    "counterKey": "personalPairs",
    "target": 500,
    "points": 10
  },
  {
    "id": "A026",
    "name": "Match 1,000 Pairs",
    "category": "Pairs",
    "description": "Personally match 1,000 pairs across all duels, including pairs matched before leaving.",
    "counterKey": "personalPairs",
    "target": 1000,
    "points": 15
  },
  {
    "id": "A027",
    "name": "Match 2,500 Pairs",
    "category": "Pairs",
    "description": "Personally match 2,500 pairs across all duels, including pairs matched before leaving.",
    "counterKey": "personalPairs",
    "target": 2500,
    "points": 15
  },
  {
    "id": "A028",
    "name": "Match 5,000 Pairs",
    "category": "Pairs",
    "description": "Personally match 5,000 pairs across all duels, including pairs matched before leaving.",
    "counterKey": "personalPairs",
    "target": 5000,
    "points": 20
  },
  {
    "id": "A029",
    "name": "Match 10,000 Pairs",
    "category": "Pairs",
    "description": "Personally match 10,000 pairs across all duels, including pairs matched before leaving.",
    "counterKey": "personalPairs",
    "target": 10000,
    "points": 25
  },
  {
    "id": "A030",
    "name": "Match 20,000 Pairs",
    "category": "Pairs",
    "description": "Personally match 20,000 pairs across all duels, including pairs matched before leaving.",
    "counterKey": "personalPairs",
    "target": 20000,
    "points": 30
  },
  {
    "id": "A031",
    "name": "Match 2 Consecutive Pairs",
    "category": "Pair chains",
    "description": "Match 2 consecutive pairs without a local mismatch in one duel; boosters do not break the chain.",
    "counterKey": "bestPairChain",
    "target": 2,
    "points": 5
  },
  {
    "id": "A032",
    "name": "Match 3 Consecutive Pairs",
    "category": "Pair chains",
    "description": "Match 3 consecutive pairs without a local mismatch in one duel; boosters do not break the chain.",
    "counterKey": "bestPairChain",
    "target": 3,
    "points": 5
  },
  {
    "id": "A033",
    "name": "Match 4 Consecutive Pairs",
    "category": "Pair chains",
    "description": "Match 4 consecutive pairs without a local mismatch in one duel; boosters do not break the chain.",
    "counterKey": "bestPairChain",
    "target": 4,
    "points": 5
  },
  {
    "id": "A034",
    "name": "Match 5 Consecutive Pairs",
    "category": "Pair chains",
    "description": "Match 5 consecutive pairs without a local mismatch in one duel; boosters do not break the chain.",
    "counterKey": "bestPairChain",
    "target": 5,
    "points": 10
  },
  {
    "id": "A035",
    "name": "Match 6 Consecutive Pairs",
    "category": "Pair chains",
    "description": "Match 6 consecutive pairs without a local mismatch in one duel; boosters do not break the chain.",
    "counterKey": "bestPairChain",
    "target": 6,
    "points": 10
  },
  {
    "id": "A036",
    "name": "Match 7 Consecutive Pairs",
    "category": "Pair chains",
    "description": "Match 7 consecutive pairs without a local mismatch in one duel; boosters do not break the chain.",
    "counterKey": "bestPairChain",
    "target": 7,
    "points": 15
  },
  {
    "id": "A037",
    "name": "Match 8 Consecutive Pairs",
    "category": "Pair chains",
    "description": "Match 8 consecutive pairs without a local mismatch in one duel; boosters do not break the chain.",
    "counterKey": "bestPairChain",
    "target": 8,
    "points": 15
  },
  {
    "id": "A038",
    "name": "Match 10 Consecutive Pairs",
    "category": "Pair chains",
    "description": "Match 10 consecutive pairs without a local mismatch in one duel; boosters do not break the chain.",
    "counterKey": "bestPairChain",
    "target": 10,
    "points": 20
  },
  {
    "id": "A039",
    "name": "Match 12 Consecutive Pairs",
    "category": "Pair chains",
    "description": "Match 12 consecutive pairs without a local mismatch in one duel; boosters do not break the chain.",
    "counterKey": "bestPairChain",
    "target": 12,
    "points": 25
  },
  {
    "id": "A040",
    "name": "Match 15 Consecutive Pairs",
    "category": "Pair chains",
    "description": "Match 15 consecutive pairs without a local mismatch in one duel; boosters do not break the chain.",
    "counterKey": "bestPairChain",
    "target": 15,
    "points": 30
  },
  {
    "id": "A041",
    "name": "Win Without Boosters",
    "category": "Conditional wins",
    "description": "Win a completed duel without using a booster before your 21st pair.",
    "counterKey": "conditionalWins.noBoosters",
    "target": 1,
    "points": 15
  },
  {
    "id": "A042",
    "name": "Win Without a Mismatch",
    "category": "Conditional wins",
    "description": "Win a completed duel without a mismatch before your 21st pair.",
    "counterKey": "conditionalWins.noMismatch",
    "target": 1,
    "points": 40
  },
  {
    "id": "A043",
    "name": "Recover Five Pairs",
    "category": "Conditional wins",
    "description": "Win after trailing by at least five pairs before your 21st pair.",
    "counterKey": "conditionalWins.recoverFive",
    "target": 1,
    "points": 20
  },
  {
    "id": "A044",
    "name": "Recover Ten Pairs",
    "category": "Conditional wins",
    "description": "Win after trailing by at least ten pairs before your 21st pair.",
    "counterKey": "conditionalWins.recoverTen",
    "target": 1,
    "points": 30
  },
  {
    "id": "A045",
    "name": "Close Finish",
    "category": "Conditional wins",
    "description": "Secure your 21st pair while the player has exactly 19, then finish the board.",
    "counterKey": "conditionalWins.closeFinish",
    "target": 1,
    "points": 25
  },
  {
    "id": "A046",
    "name": "Finish With Five Consecutive Pairs",
    "category": "Conditional wins",
    "description": "Reach your winning 21st pair with an active chain of at least five, then complete the duel.",
    "counterKey": "conditionalWins.chainFinishFive",
    "target": 1,
    "points": 15
  },
  {
    "id": "A047",
    "name": "Lead From the First Pair",
    "category": "Conditional wins",
    "description": "Score the first pair and never trail before your winning 21st pair, then finish the duel.",
    "counterKey": "conditionalWins.frontRunner",
    "target": 1,
    "points": 10
  },
  {
    "id": "A048",
    "name": "Win After the Opponent Scores First",
    "category": "Conditional wins",
    "description": "Complete a win after the player scores the first pair.",
    "counterKey": "conditionalWins.opponentFirst",
    "target": 1,
    "points": 10
  },
  {
    "id": "A049",
    "name": "Win After Three Lead Changes",
    "category": "Conditional wins",
    "description": "Complete a win after at least three actual leader changes before or on your 21st pair; ties preserve the last leader.",
    "counterKey": "conditionalWins.threeLeadChanges",
    "target": 1,
    "points": 25
  },
  {
    "id": "A050",
    "name": "Win With Two Mismatches or Fewer",
    "category": "Conditional wins",
    "description": "Complete a win with at most two local mismatches before your 21st pair.",
    "counterKey": "conditionalWins.atMostTwoMisses",
    "target": 1,
    "points": 25
  },
  {
    "id": "A051",
    "name": "First Recall",
    "category": "Memory",
    "description": "Match 1 pair whose two physical faces were both observed before the attempt began.",
    "counterKey": "rememberedPairs",
    "target": 1,
    "points": 5
  },
  {
    "id": "A052",
    "name": "Practised Recall",
    "category": "Memory",
    "description": "Match 25 pairs whose two physical faces were both observed before the attempt began.",
    "counterKey": "rememberedPairs",
    "target": 25,
    "points": 10
  },
  {
    "id": "A053",
    "name": "Consistent Recall",
    "category": "Memory",
    "description": "Match 100 pairs whose two physical faces were both observed before the attempt began.",
    "counterKey": "rememberedPairs",
    "target": 100,
    "points": 20
  },
  {
    "id": "A054",
    "name": "Attentive Play",
    "category": "Memory",
    "description": "Match 5 remembered pairs in one duel, using faces observed before each attempt.",
    "counterKey": "maxRememberedPairsInDuel",
    "target": 5,
    "points": 10
  },
  {
    "id": "A055",
    "name": "Detailed Recall",
    "category": "Memory",
    "description": "Match 10 remembered pairs in one duel, using faces observed before each attempt.",
    "counterKey": "maxRememberedPairsInDuel",
    "target": 10,
    "points": 25
  },
  {
    "id": "A056",
    "name": "An Opportunity Taken",
    "category": "Memory",
    "description": "Match immediately after a player’s mismatch once.",
    "counterKey": "matchesImmediatelyAfterOpponentMiss",
    "target": 1,
    "points": 5
  },
  {
    "id": "A057",
    "name": "Ready Observer",
    "category": "Memory",
    "description": "Match immediately after a player’s mismatch 25 times.",
    "counterKey": "matchesImmediatelyAfterOpponentMiss",
    "target": 25,
    "points": 15
  },
  {
    "id": "A058",
    "name": "Composure",
    "category": "Memory",
    "description": "Match after your preceding attempt was a mismatch once, even if a player acted in between.",
    "counterKey": "matchesAfterOwnPreviousAttemptMissed",
    "target": 1,
    "points": 5
  },
  {
    "id": "A059",
    "name": "Renewed Focus",
    "category": "Memory",
    "description": "Match after your preceding attempt was a mismatch 25 times, even if a player acted in between.",
    "counterKey": "matchesAfterOwnPreviousAttemptMissed",
    "target": 25,
    "points": 15
  },
  {
    "id": "A060",
    "name": "Both Pairs",
    "category": "Memory",
    "description": "Personally collect both pairs of 1 different picture in one duel.",
    "counterKey": "maxFullyCollectedFaceKeysInDuel",
    "target": 1,
    "points": 5
  },
  {
    "id": "A061",
    "name": "Familiar Pictures",
    "category": "Memory",
    "description": "Personally collect both pairs of 5 different pictures in one duel.",
    "counterKey": "maxFullyCollectedFaceKeysInDuel",
    "target": 5,
    "points": 20
  },
  {
    "id": "A062",
    "name": "A Fresh Discovery",
    "category": "Memory",
    "description": "Match 1 pair without either physical face having been observed before the attempt.",
    "counterKey": "pairsWithNeitherFacePreviouslyObserved",
    "target": 1,
    "points": 5
  },
  {
    "id": "A063",
    "name": "Broad Attention",
    "category": "Memory",
    "description": "Personally match 10 distinct pictures in one duel.",
    "counterKey": "maxDistinctMatchedFaceKeysInDuel",
    "target": 10,
    "points": 10
  },
  {
    "id": "A064",
    "name": "A Lasting Impression",
    "category": "Memory",
    "description": "Match 1 remembered pair after at least three intervening attempts since each face’s latest observation.",
    "counterKey": "delayedRecallPairs",
    "target": 1,
    "points": 10
  },
  {
    "id": "A065",
    "name": "Lasting Recall",
    "category": "Memory",
    "description": "Match 25 remembered pairs after at least three intervening attempts since each face’s latest observation.",
    "counterKey": "delayedRecallPairs",
    "target": 25,
    "points": 20
  },
  {
    "id": "A066",
    "name": "Helpful Direction",
    "category": "Boosters",
    "description": "Follow a Hint by matching its exact highlighted pair on your next valid attempt once.",
    "counterKey": "successfullyFollowedHints",
    "target": 1,
    "points": 5
  },
  {
    "id": "A067",
    "name": "Applied Direction",
    "category": "Boosters",
    "description": "Follow a Hint by matching its exact highlighted pair on your next valid attempt 10 times.",
    "counterKey": "successfullyFollowedHints",
    "target": 10,
    "points": 10
  },
  {
    "id": "A068",
    "name": "A Second Opportunity",
    "category": "Boosters",
    "description": "After a Freeze protects a mismatch, match on your very next attempt.",
    "counterKey": "freezeSavesFollowedByImmediateMatch",
    "target": 1,
    "points": 5
  },
  {
    "id": "A069",
    "name": "An Opportunity Extended",
    "category": "Boosters",
    "description": "After a Freeze protects a mismatch, match on your next three attempts without another mismatch.",
    "counterKey": "freezeSavesFollowedByThreePairRun",
    "target": 1,
    "points": 15
  },
  {
    "id": "A070",
    "name": "Fresh Arrangement",
    "category": "Boosters",
    "description": "Match on your first attempt after spending a Shuffle, with no intervening shuffle.",
    "counterKey": "paidShufflesFollowedByImmediateMatch",
    "target": 1,
    "points": 5
  },
  {
    "id": "A071",
    "name": "Fresh Perspective",
    "category": "Boosters",
    "description": "Match on your next three attempts after spending a Shuffle, with no mismatch or further shuffle.",
    "counterKey": "paidShufflesFollowedByThreePairRun",
    "target": 1,
    "points": 15
  },
  {
    "id": "A072",
    "name": "A Rare Find",
    "category": "Boosters",
    "description": "Match a Gold pair while Eagle Eye’s timer is active.",
    // Keep the saved counter key: Gold contains exactly the former Gold and Celestial tiles.
    "counterKey": "goldOrCelestialPairsDuringEagleEye",
    "target": 1,
    "points": 10
  },
  {
    "id": "A073",
    "name": "Guided Attention",
    "category": "Boosters",
    "description": "Personally match 10 pairs while Eagle Eye is active, across any number of uses.",
    "counterKey": "matchedPairsDuringEagleEye",
    "target": 10,
    "points": 15
  },
  {
    "id": "A074",
    "name": "Measured Assistance",
    "category": "Boosters",
    "description": "Complete a win after using exactly one booster before your 21st pair.",
    "counterKey": "conditionalWins.exactlyOneBooster",
    "target": 1,
    "points": 15
  },
  {
    "id": "A075",
    "name": "A Complete Toolkit",
    "category": "Boosters",
    "description": "Use Shuffle, Hint, Freeze and Eagle Eye before your 21st pair, then complete the win.",
    "counterKey": "conditionalWins.allFourBoosters",
    "target": 1,
    "points": 20
  },
  {
    "id": "A076",
    "name": "Picture Collection 10",
    "category": "Collection & variety",
    "description": "Discover 10 different tile pictures across the four launch collections.",
    "counterKey": "distinctCollectedMatchKeys",
    "target": 10,
    "points": 5
  },
  {
    "id": "A077",
    "name": "Picture Collection 25",
    "category": "Collection & variety",
    "description": "Discover 25 different tile pictures across the four launch collections.",
    "counterKey": "distinctCollectedMatchKeys",
    "target": 25,
    "points": 5
  },
  {
    "id": "A078",
    "name": "Picture Collection 50",
    "category": "Collection & variety",
    "description": "Discover 50 different tile pictures across the four launch collections.",
    "counterKey": "distinctCollectedMatchKeys",
    "target": 50,
    "points": 10
  },
  {
    "id": "A079",
    "name": "Picture Collection 100",
    "category": "Collection & variety",
    "description": "Discover 100 different tile pictures across the four launch collections.",
    "counterKey": "distinctCollectedMatchKeys",
    "target": 100,
    "points": 20
  },
  {
    "id": "A080",
    "name": "Picture Collection 200",
    "category": "Collection & variety",
    "description": "Discover 200 different tile pictures across the four launch collections.",
    "counterKey": "distinctCollectedMatchKeys",
    "target": 200,
    "points": 30
  },
  {
    "id": "A081",
    "name": "Ming Porcelain Collection",
    "category": "Collection & variety",
    "description": "Discover 25 different Ming porcelain tile pictures across both editions.",
    "counterKey": "distinctCollectedMatchKeysByTheme.ming-porcelain",
    "target": 25,
    "points": 10
  },
  {
    "id": "A082",
    "name": "Dancheong Collection",
    "category": "Collection & variety",
    "description": "Discover 25 different Dancheong tile pictures across both editions.",
    "counterKey": "distinctCollectedMatchKeysByTheme.dancheong",
    "target": 25,
    "points": 10
  },
  {
    "id": "A083",
    "name": "Stained Glass Collection",
    "category": "Collection & variety",
    "description": "Discover 25 different Stained Glass tile pictures across both editions.",
    "counterKey": "distinctCollectedMatchKeysByTheme.stained-glass",
    "target": 25,
    "points": 10
  },
  {
    "id": "A084",
    "name": "Dutch Golden Age Collection",
    "category": "Collection & variety",
    "description": "Discover 25 different Dutch Golden Age tile pictures across both editions.",
    "counterKey": "distinctCollectedMatchKeysByTheme.dutch-golden-age",
    "target": 25,
    "points": 10
  },
  {
    "id": "A085",
    "name": "Three Formations",
    "category": "Collection & variety",
    "description": "Complete duels on 3 different formations.",
    "counterKey": "distinctCompletedFormationIds",
    "target": 3,
    "points": 10
  },
  {
    "id": "A086",
    "name": "Six Formations",
    "category": "Collection & variety",
    "description": "Complete duels on 6 different formations.",
    "counterKey": "distinctCompletedFormationIds",
    "target": 6,
    "points": 20
  },
  {
    "id": "A087",
    "name": "Twelve Formations",
    "category": "Collection & variety",
    "description": "Complete duels on 12 different formations.",
    "counterKey": "distinctCompletedFormationIds",
    "target": 12,
    "points": 30
  },
  {
    "id": "A088",
    "name": "Both Traditions",
    "category": "Collection & variety",
    "description": "Complete at least one Eastern and one Western duel.",
    "counterKey": "distinctCompletedRulesetIds",
    "target": 2,
    "points": 10
  },
  {
    "id": "A089",
    "name": "A Familiar Picture",
    "category": "Collection & variety",
    "description": "Match one launch-collection picture 10 times; duplicate counts count pairs.",
    "counterKey": "maxCollectionCountForOneMatchKey",
    "target": 10,
    "points": 10
  },
  {
    "id": "A090",
    "name": "Every Rarity",
    "category": "Collection & variety",
    "description": "Collect at least one picture from every rarity: Marble, Sapphire, Amethyst and Gold.",
    "counterKey": "distinctCollectedRarityIds",
    "target": 4,
    "points": 15
  },
  {
    "id": "A091",
    "name": "Three Visits",
    "category": "Participation",
    "description": "Visit on 3 different UTC days; missed days do not erase progress.",
    "counterKey": "distinctLoginDayIds",
    "target": 3,
    "points": 5
  },
  {
    "id": "A092",
    "name": "Seven Visits",
    "category": "Participation",
    "description": "Visit on 7 different UTC days; missed days do not erase progress.",
    "counterKey": "distinctLoginDayIds",
    "target": 7,
    "points": 10
  },
  {
    "id": "A093",
    "name": "Fourteen Visits",
    "category": "Participation",
    "description": "Visit on 14 different UTC days; missed days do not erase progress.",
    "counterKey": "distinctLoginDayIds",
    "target": 14,
    "points": 15
  },
  {
    "id": "A094",
    "name": "Thirty Visits",
    "category": "Participation",
    "description": "Visit on 30 different UTC days; missed days do not erase progress.",
    "counterKey": "distinctLoginDayIds",
    "target": 30,
    "points": 20
  },
  {
    "id": "A095",
    "name": "Sixty Visits",
    "category": "Participation",
    "description": "Visit on 60 different UTC days; missed days do not erase progress.",
    "counterKey": "distinctLoginDayIds",
    "target": 60,
    "points": 30
  },
  {
    "id": "A096",
    "name": "Three Playing Days",
    "category": "Participation",
    "description": "Complete at least one duel on 3 different UTC days.",
    "counterKey": "distinctDuelCompletionDayIds",
    "target": 3,
    "points": 5
  },
  {
    "id": "A097",
    "name": "Seven Playing Days",
    "category": "Participation",
    "description": "Complete at least one duel on 7 different UTC days.",
    "counterKey": "distinctDuelCompletionDayIds",
    "target": 7,
    "points": 10
  },
  {
    "id": "A098",
    "name": "Thirty Playing Days",
    "category": "Participation",
    "description": "Complete at least one duel on 30 different UTC days.",
    "counterKey": "distinctDuelCompletionDayIds",
    "target": 30,
    "points": 20
  },
  {
    "id": "A099",
    "name": "Varied Tables",
    "category": "Participation",
    "description": "Complete duels in 4 different combinations of launch tile theme and ruleset.",
    "counterKey": "distinctCompletedThemeRulesetCombinations",
    "target": 4,
    "points": 15
  },
  {
    "id": "A100",
    "name": "Every Setting",
    "category": "Participation",
    "description": "Complete duels in 8 different combinations of launch tile theme and ruleset.",
    "counterKey": "distinctCompletedThemeRulesetCombinations",
    "target": 8,
    "points": 25
  }
].map(Object.freeze));
export const ACHIEVEMENT_REWARDS_VERSION = 5;
export const THEME_ACHIEVEMENTS_VERSION = 1;
export const MILESTONE_REWARD_SCHEDULE = Object.freeze([5, 10, 15, 25, 40, 60, 85, 115, 150, 200]);
export const LEGACY_ACHIEVEMENT_POINTS = Object.freeze(Object.fromEntries(LEGACY_ACHIEVEMENTS.map(item => [item.id, item.points])));
const nextRewards = new Map();
for (const key of new Set(LEGACY_ACHIEVEMENTS.map(item => item.counterKey))) {
  const levels = LEGACY_ACHIEVEMENTS.filter(item => item.counterKey === key).sort((a, b) => a.target - b.target);
  let previous = 0;
  levels.forEach((item, index) => {
    const points = levels.length === 1 ? item.points : Math.max(item.points, MILESTONE_REWARD_SCHEDULE[index], previous + 5);
    nextRewards.set(item.id, points);
    previous = points;
  });
}
const winningPairOrdinal = `${PAIRS_TO_WIN}${PAIRS_TO_WIN % 100 >= 11 && PAIRS_TO_WIN % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[PAIRS_TO_WIN % 10] ?? 'th')}`;
// Current copy follows the trial board size; saved IDs and earned point receipts remain unchanged.
export const PREVIOUS_ACHIEVEMENTS = Object.freeze(LEGACY_ACHIEVEMENTS.map(item => Object.freeze({ ...item,
  description: item.description.replaceAll('all 40 pairs', `all ${PAIRS_PER_DUEL} pairs`)
    .replaceAll('21st pair', `${winningPairOrdinal} pair`).replaceAll('exactly 19', `exactly ${PAIRS_PER_DUEL - PAIRS_TO_WIN}`),
  points: nextRewards.get(item.id),
})));
// Keep the v3 receipt ceiling even when a new reward is lower (165 becomes 150).
// Historical payouts, including partial family-budget payouts, are never repriced.
export const PREVIOUS_FOUR_LEVEL_POINTS = Object.freeze(Object.fromEntries(
  [...Array(4).fill([5, 35, 165, 500]), ...Array(2).fill([5, 10, 25, 55])]
    .flat().map((points, index) => [`M${String(index + 1).padStart(3, '0')}`, points])));

// Every milestone advances by one equally sized AP step. Requirements still
// become steeper, but no final reward dwarfs the earlier levels or one-time feats.
export const MILESTONE_POINT_STEPS = Object.freeze([50, 100, 150, 200]);
export const FOUR_LEVEL_TRACKS = Object.freeze([
  ['completedDuels', [1, 10, 35, 100], n => `Complete ${n.toLocaleString('en-US')} ${n === 1 ? 'Duel' : 'Duels'}`, n => `Complete ${n.toLocaleString('en-US')} ${n === 1 ? 'duel' : 'duels'} by clearing all ${PAIRS_PER_DUEL} pairs; wins, losses and draws count.`],
  ['completedWins', [1, 5, 20, 60], n => `Win ${n} ${n === 1 ? 'Duel' : 'Duels'}`, n => `Win ${n} completed ${n === 1 ? 'duel' : 'duels'}; abandoned boards do not count.`],
  ['personalPairs', [10, 150, 600, 1800], n => `Match ${n.toLocaleString('en-US')} Pairs`, n => `Personally match ${n.toLocaleString('en-US')} pairs across all duels, including pairs matched before leaving.`],
  ['bestPairChain', [2, 4, 7, 12], n => `Match ${n} Consecutive Pairs`, n => `Match ${n} consecutive pairs without a local mismatch in one duel; boosters do not break the chain.`],
  ['distinctCollectedMatchKeys', [10, 35, 80, 160], n => `Picture Collection ${n}`, n => `Discover ${n} different tile pictures across the four launch collections.`],
  ['distinctLoginDayIds', [1, 7, 21, 60], n => `Visit on ${n} ${n === 1 ? 'Day' : 'Days'}`, n => `Visit on ${n} ${n === 1 ? 'UTC day' : 'different UTC days'}; missed days do not erase progress.`],
].map(([counterKey, targets, name, description], group) => Object.freeze({ counterKey,
  milestones: Object.freeze(targets.map((target, index) => Object.freeze({
    id: `M${String(group * 4 + index + 1).padStart(3, '0')}`, counterKey, target, points: MILESTONE_POINT_STEPS[index],
    category: PREVIOUS_ACHIEVEMENTS.find(item => item.counterKey === counterKey).category, name: name(target), description: description(target),
  }))),
})));
const resizedTracks = new Map(FOUR_LEVEL_TRACKS.map(track => [track.counterKey, track]));
// Stable IDs retain old reward receipts while the goals follow the four themes.
const themeAchievementUpdates = {
  A088: { name: 'Across Continents', counterKey: 'distinctCompletedCulturalRegions', target: 2,
    description: 'Complete a duel in Ming Porcelain or Dancheong, and a duel in Stained Glass or Dutch Golden Age.' },
  A099: { name: 'Grand Tour: Two Themes', counterKey: 'distinctCompletedThemeIds', target: 2,
    description: 'Complete duels in 2 different tile themes; wins, losses and draws count.' },
  A100: { name: 'Grand Tour: Four Themes', counterKey: 'distinctCompletedThemeIds', target: 4,
    description: 'Complete duels in all 4 tile themes: Ming Porcelain, Dancheong, Stained Glass and Dutch Golden Age.' },
};
// Collection goals also migrate silently because archived counterpart copies
// can combine into an already-earned picture count.
const themeTransitionIds = new Set(['A081', 'A082', 'A083', 'A084', 'A088', 'A089', 'A090', 'A099', 'A100', 'M017', 'M018', 'M019', 'M020']);
// The brief v4 round-reward release is still a valid source of saved receipts.
const roundRewards = new Map();
for (const key of new Set(PREVIOUS_ACHIEVEMENTS.map(item => item.counterKey))) {
  let previous = 0;
  for (const item of PREVIOUS_ACHIEVEMENTS.filter(item => item.counterKey === key).sort((a, b) => a.target - b.target)) {
    const points = item.id === 'A042' ? 50 : Math.max(Math.ceil(item.points / 10) * 10, previous + 10);
    roundRewards.set(item.id, points);
    previous = points;
  }
}
export const V4_ACHIEVEMENT_POINTS = Object.freeze(Object.fromEntries([
  ...PREVIOUS_ACHIEVEMENTS.filter(item => !resizedTracks.has(item.counterKey)).map(item => [item.id, roundRewards.get(item.id)]),
  ...[...Array(4).fill([10, 40, 150, 500]), ...Array(2).fill([10, 20, 40, 80])]
    .flat().map((points, index) => [`M${String(index + 1).padStart(3, '0')}`, points]),
]));

// One-time achievements are priced by their actual condition: introductory
// actions 50, sustained/skillful actions 100, difficult feats 150, perfect win 200.
export const SINGLE_ACHIEVEMENT_POINTS = Object.freeze({
  A041: 50, A042: 200, A043: 100, A044: 150, A045: 100, A046: 100, A047: 50, A048: 50, A049: 150, A050: 150,
  A062: 50, A063: 100, A068: 50, A069: 100, A070: 50, A071: 100, A072: 50, A073: 100, A074: 50, A075: 100,
  A081: 100, A082: 100, A083: 100, A084: 100, A088: 150, A089: 100, A090: 50,
});
const balancedRewards = new Map();
for (const key of new Set(PREVIOUS_ACHIEVEMENTS.map(item => item.counterKey))) {
  if (resizedTracks.has(key)) continue;
  const levels = PREVIOUS_ACHIEVEMENTS.filter(item => item.counterKey === key).sort((a, b) => a.target - b.target);
  levels.forEach((item, index) => balancedRewards.set(item.id,
    levels.length === 1 ? SINGLE_ACHIEVEMENT_POINTS[item.id] : MILESTONE_POINT_STEPS[index]));
}
export const ACHIEVEMENTS = Object.freeze(PREVIOUS_ACHIEVEMENTS.flatMap(item => {
  const track = resizedTracks.get(item.counterKey);
  if (!track) return [Object.freeze({ ...item, points: balancedRewards.get(item.id), description: item.description.replace(' across both editions', ''), ...themeAchievementUpdates[item.id] })];
  return PREVIOUS_ACHIEVEMENTS.find(previous => previous.counterKey === item.counterKey).id === item.id ? track.milestones : [];
}));
export const ACHIEVEMENT_POINTS_MAX = ACHIEVEMENTS.reduce((sum, item) => sum + item.points, 0);
// Archived IDs remain readable for timestamp/AP receipts and old notification
// batches. Only ACHIEVEMENTS is evaluated or presented as the active catalogue.
export const achievementById = Object.freeze(Object.assign(Object.create(null), Object.fromEntries([...PREVIOUS_ACHIEVEMENTS, ...ACHIEVEMENTS].map(item => [item.id, item]))));
export const isAchievementId = id => typeof id === 'string' && Object.hasOwn(achievementById, id);
export const ACHIEVEMENT_CATEGORIES = Object.freeze([...new Set(ACHIEVEMENTS.map(item => item.category))]);
// Keep the archived edition sets readable as evidence for themed history.
export const COUNTER_KEYS = Object.freeze([...new Set([...ACHIEVEMENTS.map(item => item.counterKey), 'distinctCompletedRulesetIds', 'distinctCompletedThemeRulesetCombinations'])]);
export const SET_COUNTER_KEYS = Object.freeze(COUNTER_KEYS.filter(key => key.startsWith('distinct')));
export const NUMERIC_COUNTER_KEYS = Object.freeze(COUNTER_KEYS.filter(key => !key.startsWith('distinct')));

export function activeAchievementIdFor(id) {
  if (!isAchievementId(id)) return null;
  const definition = achievementById[id];
  const track = resizedTracks.get(definition.counterKey);
  if (!track || track.milestones.some(item => item.id === id)) return id;
  return track.milestones.filter(item => item.target <= definition.target).at(-1)?.id ?? track.milestones[0].id;
}

export function getCounter(state, key) {
  if (!COUNTER_KEYS.includes(key)) return 0;
  if (SET_COUNTER_KEYS.includes(key)) return new Set(Array.isArray(state?.sets?.[key]) ? state.sets[key] : []).size;
  const value = state?.counters?.[key];
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function achievementProgress(achievement, state) {
  const id = typeof achievement === 'string' ? achievement : achievement?.id;
  if (!isAchievementId(id)) return null;
  const definition = achievementById[id];
  const current = getCounter(state, definition.counterKey);
  const unlocked = Object.hasOwn(state?.unlocked ?? {}, definition.id);
  return { current, target: definition.target, progress: Math.min(1, current / definition.target),
    unlocked, unlockedAt: unlocked ? state.unlocked[definition.id] : null };
}

/** Original receipts retain their AP; converted goals may have explicit zero receipts. */
export function awardedAchievementPoints(id, state) {
  if (!isAchievementId(id) || !Object.hasOwn(state?.unlocked ?? {}, id)) return 0;
  const amount = Object.hasOwn(state?.awardedPoints ?? {}, id) ? state.awardedPoints[id] : undefined;
  if (id.startsWith('M') || themeTransitionIds.has(id) && amount === 0) {
    // Zero is a migration receipt; partial payouts are valid historical v3 AP.
    const ceiling = Math.max(achievementById[id].points, PREVIOUS_FOUR_LEVEL_POINTS[id] ?? 0, V4_ACHIEVEMENT_POINTS[id] ?? 0);
    return Number.isSafeInteger(amount) && amount >= 0 && amount <= ceiling ? amount : 0;
  }
  return Number.isSafeInteger(amount) && (amount === LEGACY_ACHIEVEMENT_POINTS[id] || amount === nextRewards.get(id) || amount === V4_ACHIEVEMENT_POINTS[id] || amount === achievementById[id].points)
    ? amount : LEGACY_ACHIEVEMENT_POINTS[id];
}

export function earnedPointsForCounter(counterKey, state) {
  return Object.keys(state?.unlocked ?? {}).filter(id => isAchievementId(id) && achievementById[id].counterKey === counterKey)
    .reduce((sum, id) => sum + awardedAchievementPoints(id, state), 0);
}

export function evaluateAchievements(state, now = Date.now(), allowedIds) {
  const unlocked = Object.fromEntries(Object.entries(state.unlocked ?? {}).filter(([id, timestamp]) =>
    isAchievementId(id) && Number.isSafeInteger(timestamp) && timestamp >= 0 && timestamp <= 8640000000000000));
  const awardedPoints = Object.fromEntries(Object.keys(unlocked).map(id => [id, awardedAchievementPoints(id, state)]));
  const newlyUnlocked = [];
  const allowed = allowedIds && new Set(allowedIds);
  for (const track of FOUR_LEVEL_TRACKS) {
    const historical = PREVIOUS_ACHIEVEMENTS.filter(item => item.counterKey === track.counterKey && Object.hasOwn(unlocked, item.id));
    // The persisted reward version makes retries idempotent. The second check
    // recovers a historical-only family after an older client has saved it.
    if (state.achievementRewardsVersion < 3 || state.achievementRewardsVersion == null ||
        historical.length > 0 && !track.milestones.some(item => Object.hasOwn(unlocked, item.id))) {
      const attained = Math.max(getCounter(state, track.counterKey), ...historical.map(item => item.target));
      for (const item of track.milestones) {
        if (attained < item.target || Object.hasOwn(unlocked, item.id)) continue;
        const evidence = historical.filter(previous => previous.target >= item.target).map(previous => unlocked[previous.id]);
        unlocked[item.id] = evidence.length ? Math.min(...evidence) : now;
        awardedPoints[item.id] = 0;
      }
    }
  }
  // Import already attained replacement goals silently. Existing IDs, timestamps
  // and AP stay untouched; new copies of historical progress never pay twice.
  if ((state.themeAchievementsVersion ?? 0) < THEME_ACHIEVEMENTS_VERSION) {
    for (const definition of ACHIEVEMENTS.filter(item => themeTransitionIds.has(item.id))) {
      if (!Object.hasOwn(unlocked, definition.id) && getCounter(state, definition.counterKey) >= definition.target) {
        unlocked[definition.id] = now;
        awardedPoints[definition.id] = 0;
      }
    }
  }
  for (const definition of ACHIEVEMENTS) {
    if ((!allowed || allowed.has(definition.id)) && !Object.hasOwn(unlocked, definition.id) && getCounter(state, definition.counterKey) >= definition.target) {
      unlocked[definition.id] = now;
      // Every new unlock pays the advertised amount. Preserved old receipts
      // must not shave a round future reward into a partial payout such as 490.
      awardedPoints[definition.id] = definition.points;
      newlyUnlocked.push(definition.id);
    }
  }
  const points = Object.values(awardedPoints).reduce((sum, amount) => sum + amount, 0);
  return { unlocked, awardedPoints, achievementRewardsVersion: ACHIEVEMENT_REWARDS_VERSION, themeAchievementsVersion: THEME_ACHIEVEMENTS_VERSION, points, newlyUnlocked };
}
