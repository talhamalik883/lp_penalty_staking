# lp_penalty_staking
This Codebase let user stake and lock their lp for the specified time. User will face penalty in reward amount incase try to withdraw before locktime
# LP Staking with Locking Mechanism

Clone the repo

```shell
git clone https://github.com/talhamalik883/lp_penalty_staking.git
```

# Configure the deployment

Code is developed and tested using hardhat frameword
# Install Dependencies

```
npm install

```

# for Compilation do run following command

```
npx hardhat compile
```

# Run Ganache Cli for test cases

```
ganache-cli -m "cupboard tennis easy year sunset puppy silent soul athlete good flight resemble" -h 0.0.0.0
```

# Run Test Cases

```
npx hardhat test --ganache
```

# for Deployment do run following command

1. Make sure to copy .env.example to .env and add needed values
2. Update variables in scripts/deploy.js file
3. Utilized the commented code in deploy.js file if needed

```
npx hardhat run scripts/deploy.js --network networkname
```
