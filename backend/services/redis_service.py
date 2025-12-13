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
    
    def update_user_stats(self, username: str, wpm: float, accuracy: float):
        """
        Update user profile stats (total races, avg wpm, max wpm).
        """
        if not self.enabled:
            return

        user_key = f"user:{username}:stats"
        
        try:
            # Get current stats
            stats = self.client.hgetall(user_key)
            
            races = int(stats.get("races_completed", 0))
            current_avg_wpm = float(stats.get("avg_wpm", 0))
            max_wpm = float(stats.get("max_wpm", 0))
            
            # Calculate new stats
            new_races = races + 1
            # Rolling average: ((old_avg * old_count) + new_val) / new_count
            new_avg_wpm = ((current_avg_wpm * races) + wpm) / new_races
            new_max_wpm = max(max_wpm, wpm)
            
            self.client.hset(user_key, mapping={
                "races_completed": new_races,
                "avg_wpm": new_avg_wpm,
                "max_wpm": new_max_wpm,
                "last_active": str(datetime.now())
            })
        except Exception as e:
            logger.error(f"Failed to update user stats: {e}")

    def get_user_stats(self, username: str):
        """
        Get user profile stats.
        """
        if not self.enabled:
            return None
            
        user_stats_key = f"user:stats:{username}"
        try:
            stats = self.client.hgetall(user_stats_key)
            if not stats:
                return {
                    "races_completed": 0,
                    "avg_wpm": 0,
                    "max_wpm": 0
                }
            
            races = int(stats.get("races_completed", 0))
            total_wpm = float(stats.get("total_wpm", 0))
            max_wpm = float(stats.get("max_wpm", 0))
            
            avg_wpm = round(total_wpm / races, 1) if races > 0 else 0

            return {
                "races_completed": races,
                "avg_wpm": avg_wpm,
                "max_wpm": max_wpm
            }
        except Exception as e:
            logger.error(f"Failed to get user stats: {e}")
            return None

    def add_score(self, problem_id: str, language: str, username: str, wpm: float, accuracy: float, score: float):
        """
        Add score to leaderboard using ZSET for ranking and Hash for details.
        Also updates global user stats.
        """

        if not self.enabled:
            return
        
        lb_key = f"leaderboard:{problem_id}:{language}"
        details_key = f"score_details:{problem_id}:{language}:{username}"
        user_stats_key = f"user:stats:{username}"

        try:
            # 1. Update Global User Stat
            # We need to track total WPM sum to calculate average
            pipe = self.client.pipeline()
            pipe.hincrby(user_stats_key, "races_completed", 1)
            pipe.hincrbyfloat(user_stats_key, "total_wpm", wpm)
            
            # Check if this is a new max WPM
            current_max_wpm = self.client.hget(user_stats_key, "max_wpm")
            if current_max_wpm is None or wpm > float(current_max_wpm):
                pipe.hset(user_stats_key, "max_wpm", wpm)
            
            pipe.execute()

            # 2. Update Leaderboard (Only if high score)
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

    def get_user_problem_stats(self, problem_id: str, language: str, username: str):
        """
        Get a user's best performance for a specific problem.
        """
        if not self.enabled:
            return None
            
        details_key = f"score_details:{problem_id}:{language}:{username}"
        try:
            details = self.client.hgetall(details_key)
            if not details:
                return None
            
            rank = self.get_user_rank(problem_id, language, username)
            
            return {
                "wpm": float(details.get("wpm", 0)),
                "accuracy": float(details.get("accuracy", 0)),
                "score": float(details.get("score", 0)),
                "timestamp": details.get("timestamp"),
                "rank": rank
            }
        except Exception as e:
            logger.error(f"Failed to get user problem stats: {e}")
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
                
                # Fallback for og data (where score was just wpm)
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