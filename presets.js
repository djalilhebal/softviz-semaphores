const myAttempt = {

semaNames: 'sLight, sEmpty',
semaVals: '1, 1',

intNames: 'light',
intVals: '1',

controller:
`while (true) {
  sleep(15) //interval
  p(sLight)
  if (light == 1) {
    light = 2
  } else {
    light = 1
  }
  v(sLight)
}`,

traverser1:
`while (true) {
  p(sLight)
  if (light == 1) {
    p(sEmpty)
    traverse()
    v(sEmpty)
    v(sLight)
    break;
  }
  v(sLight)
}`,

traverser2:
`while (true) {
  p(sLight)
  if (light == 2) {
    p(sEmpty)
    traverse()
    v(sEmpty)
    v(sLight)
    break;
  }
  v(sLight)
}`,

}

const correctAnswer = {

semaNames: 'sLight1, sLight2, sEmpty1, sEmpty2',
semaVals: '1, 0, 1, 1',

intNames: 'light',
intVals: '1',

controller:
`while (1) {
  sleep(15) //interval
  if (light == 1) {
    p(sLight1)
    light = 2
    v(sLight2)
  } else {
    p(sLight2)
    light = 1
    v(sLight1)
  }
}`,

traverser1:
`p(sEmpty1)
p(sLight1)
traverse()
v(sLight1)
v(sEmpty1)`,

traverser2: `p(sEmpty2)
p(sLight2)
traverse()
v(sLight2)
v(sEmpty2)`,

}

// Export, sorta
Sim.presets = {myAttempt, correctAnswer};
