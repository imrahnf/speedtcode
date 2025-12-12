var addTwoNumbers = function (l1, l2, carry = 0) {
    let sentinel = (tail = new ListNode());

    while (l1 || l2 || carry) {
        const sum = (l1?.val || 0) + (l2?.val || 0) + carry;
        const val = sum % 10;
        carry = Math.floor(sum / 10);

        tail.next = new ListNode(val);
        tail = tail.next;

        l1 = l1?.next || null;
        l2 = l2?.next || null;
    }

    return sentinel.next;
};
