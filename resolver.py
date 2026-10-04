from models import BetType, BetStatus

def resolve_bet(bet_criteria: dict, cv_results: dict, bet_type: str) -> tuple[BetStatus, float]:
    if bet_type == BetType.COUNT_PREDICTION:
        target = bet_criteria.get("target_count")
        operator = bet_criteria.get("operator", "exact")
        actual = cv_results.get("detected_count")
        if actual is None:
            return BetStatus.VOID, 0.0
        won = False
        if operator == "exact":
            won = (actual == target)
            multiplier = 5.0
        elif operator == "over":
            won = (actual > target)
            multiplier = 1.8
        elif operator == "under":
            won = (actual < target)
            multiplier = 1.8
        else:
            return BetStatus.VOID, 0.0
        if won:
            return BetStatus.WON, multiplier
        else:
            return BetStatus.LOST, 0.0
    elif bet_type == BetType.TIME_PREDICTION:
        threshold_sec = bet_criteria.get("threshold_seconds")
        actual_duration = cv_results.get("green_light_duration")
        if actual_duration >= threshold_sec:
             return BetStatus.WON, 2.0
        else:
             return BetStatus.LOST, 0.0
    return BetStatus.VOID, 0.0
