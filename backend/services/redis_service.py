import os
import redis
import logging
from datetime import datetime

logger = logging.getLogger("uvicorn")

class RedisService:
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL")
        self.client = None
        self.enabled = False

        if self.redis_url:
            try:
                self.client = redis.Redis.from_url(self.redis_url, decode_responses=True)
                self.client.ping() # Test connection
                self.enabled = True

                logger.info("Connected to Redis successfully.")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
        else:
            logger.info("REDIS_URL not set")
    
    def add_score(self, problem_id: str, language: str, username: str, wpm: float, accuracy: float, score: float):
        """
        Add score to leaderboard using ZSET for ranking and Hash for details.
        """

        if not self.enabled:
            return
        
        lb_key = f"leaderboard:{problem_id}:{language}"
        details_key = f"score_details:{problem_id}:{language}:{username}"

        try:
            # Check current score first
            current_score = self.client.zscore(lb_key, username)
            
            # Update if new score is better or no previous score
            if current_score is None or score > current_score:
                pipe = self.client.pipeline()
                pipe.zadd(lb_key, {username: score})
                pipe.hset(details_key, mapping={
                    "wpm": wpm,
                    "accuracy": accuracy,
                    "score": score,
                    "timestamp": str(datetime.now())
                })
                pipe.execute()
        except Exception as e:
            logger.error(f"Failed to add score to Redis leaderboard: {e}")

    def get_user_rank(self, problem_id: str, language: str, username: str):
        if not self.enabled:
            return None
        
        lb_key = f"leaderboard:{problem_id}:{language}"
        try:
            # zrevrank returns 0-based index, so add 1
            rank = self.client.zrevrank(lb_key, username)
            return rank + 1 if rank is not None else None
        except Exception as e:
            logger.error(f"Failed to get user rank: {e}")
            return None

    def get_leaderboard(self, problem_id: str, language: str, limit: int = 50):
        # Retrieve top scores from leaderboard
        if not self.enabled:
            return []
        
        lb_key = f"leaderboard:{problem_id}:{language}"
        try:
            results = self.client.zrevrange(lb_key, 0, limit - 1, withscores=True)
            leaderboard = []
            for rank, (username, score) in enumerate(results, start=1):
                # Fetch details
                details_key = f"score_details:{problem_id}:{language}:{username}"
                details = self.client.hgetall(details_key)
                
                # Fallback for legacy data (where score was just wpm)
                wpm = float(details.get("wpm", score))
                accuracy = float(details.get("accuracy", 100.0))

                leaderboard.append({
                    "rank": rank,
                    "username": username,
                    "score": score,
                    "wpm": wpm,
                    "accuracy": accuracy
                })
            return leaderboard
        except Exception as e:
            logger.error(f"Failed to get leaderboard: {e}")
            return []
        
# Singleton instance
redis_service = RedisService()