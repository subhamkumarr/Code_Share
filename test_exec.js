fetch('http://localhost:5000/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        code: '#include <iostream>\nusing namespace std;\nint main() { cout << "Hello from Server!"; return 0; }',
        language: 'cpp'
    })
})
    .then(res => res.json())
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(err => console.error('Fetch error:', err));
