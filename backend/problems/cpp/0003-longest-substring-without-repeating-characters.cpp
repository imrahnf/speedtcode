class Solution {
public:
    int lengthOfLongestSubstring(string& s) {
        unordered_set<char> chars;
        int maxSize = 0;
        int i = 0, j = 0;
        while (j < s.size()){
            while (chars.find(s[j]) != chars.end()){
                chars.erase(s[i]);
                ++i;
            }
            maxSize = max(maxSize, j - i + 1);
            chars.insert(s[j]);
            ++j;
        }
        return maxSize;
    }
};
