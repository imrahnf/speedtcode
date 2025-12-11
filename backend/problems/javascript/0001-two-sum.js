var twoSum = (nums, target) => {
    for (let curr = 0; curr < nums.length; curr++) {
        const complement = target - nums[curr];

        for (let next = curr + 1; next < nums.length; next++) {
            const num = nums[next];

            const isTarget = num === complement;
            if (isTarget) return [curr, next];
        }
    }

    return [-1, -1];
};