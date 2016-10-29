/**
 * debuk
 *
 * Copyright © 2016 . All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */
/* eslint-env mocha */
import chai, { expect } from 'chai';
import debuk, { defaults } from '../src/index.js';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import _ from 'lodash';
import classMethods from 'class-methods';

chai.use(sinonChai);

const mockConsole = () => ({
  log: sinon.spy(),
  count: sinon.spy(),
  time: sinon.spy(),
  timeEnd: sinon.spy(),
  trace: sinon.spy(),
  profile: sinon.spy(),
  profileEnd: sinon.spy(),
});

describe('debuk', () => {
  describe('General', () => {
    it('Should use warning message when method is not avaialble', () => {
      const warn = sinon.spy();
      const myFn = (a, b) => a + b;
      const wrp = debuk(myFn, {
        profile: true,
        time: false,
        count: false,
        trace: true,
        console: {
          warn,
        },
      });
      wrp(2);
      expect(warn).have.been.calledWith(defaults.TEMPLATE.notSupported('console.profile'));
      expect(warn).have.been.calledWith(defaults.TEMPLATE.notSupported('console.trace'));
    });

    it('Should call with this binding', () => {
      let fnFromDifferentContext;

      // issolated context
      (() => {
        const glb = 5;
        fnFromDifferentContext = () => glb;
      })();

      const prefFn = debuk(fnFromDifferentContext);
      expect(prefFn()).to.be.equal(5);
    });

    it('Should return the called function when executed', () => {
      const mockedConsole = mockConsole();

      const myFn = (a, b) => a + b;
      const name = 'test';
      const perfFn = debuk(myFn, {
        params: true,
        name,
        console: mockedConsole,
        trace: true,
        profile: true,
      });
      const args = [
        [1, 3],
        [-3, 4],
      ];
      args.forEach(input => {
        const results = myFn(...input);
        expect(perfFn(...input)).to.be.equal(results);
      });
    });
    it('Should check multiple method when debuk called', () => {
      class MyClass {
        constructor(name) {
          this.name = name;
        }
        speak(words) {
          return `${this.name}: ${words}`;
        }
        sit() {
          return `${this.name} sit.`;
        }
      }
      const PerfClass = debuk(MyClass);
      const args = classMethods(MyClass);

      args.forEach(method => {
        const results = new MyClass();
        const perf = new PerfClass();
        expect(perf[method]()).to.be.equal(results[method]());
      });
    });
  });

  describe('Count', () => {
    it('should use count by default', (cb) => {
      const mockedConsole = mockConsole();
      const myFn = (a, b) => a + b;
      const perfFn = debuk(myFn, {
        console: mockedConsole,
      });
      perfFn(1, 2);

      // check in a defer
      _.defer(() => {
        expect(mockedConsole.log)
          .have.been.calledWith(defaults.TEMPLATE.count('myFn', 1));
        cb();
      });
    });
    it('should not use count when not specified', (cb) => {
      const mockedConsole = mockConsole();
      const myFn = (a, b) => a + b;
      const perfFn = debuk(myFn, {
        console: mockedConsole,
        count: false,
      });
      perfFn(1, 2);

      // check in a defer
      _.defer(() => {
        expect(mockedConsole.log)
          .have.not.been.called;
        cb();
      });
    });

    it('Should return correct call count within a single execution cycle', (cb) => {
      const mockedConsole = mockConsole();
      const myFn = (a, b) => a + b;
      const perfFn = debuk(myFn, {
        console: mockedConsole,
      });
      perfFn(1, 2);
      perfFn(1, 2);
      perfFn(1, 2);

      expect(mockedConsole.log).not.have.been.called;

      // check in a defer
      _.defer(() => {
        expect(mockedConsole.log)
          .have.been.calledWith(defaults.TEMPLATE.count('myFn', 3));
        cb();
      });
    });
  });

  describe('Promise', () => {
    it('Default option to use promise', (cb) => {
      const mockedConsole = mockConsole();
      function fnWithPromise(a, b) {
        return Promise.resolve(a + b);
      }
      // const debukedFn = debuk(fnWithPromise, { params: true});
      const debukedFn = debuk(fnWithPromise, { params: true, console: mockedConsole });
      const result = debukedFn(1, 5);
      expect(result).to.be.a.promise;
      expect(mockedConsole.log).not.have.been.called;

      result.then((value) => {
        expect(value).to.be.equal(6);
        expect(mockedConsole.log)
          .have.been.calledWith(...defaults.TEMPLATE.params('fnWithPromise', [1, 5], 6));

        // count in defered promise
        _.defer(() => {
          expect(mockedConsole.log)
            .have.been.calledWith(defaults.TEMPLATE.count('fnWithPromise', 1));
          cb();
        });
      });
    });

    it('Return promise when promise flag is not set', (cb) => {
      const mockedConsole = mockConsole();
      function fnWithPromise(a, b) {
        return Promise.resolve(a + b);
      }
      const debukedFn = debuk(fnWithPromise, {
        params: true,
        promise: false,
        console: mockedConsole,
      });

      const result = debukedFn(1, 5);
      expect(result).to.be.a.promise;

      expect(mockedConsole.log)
        .have.been.calledWith(...defaults.TEMPLATE.params('fnWithPromise', [1, 5], result));

      // count in defered promise
      _.defer(() => {
        expect(mockedConsole.log)
          .have.been.calledWith(defaults.TEMPLATE.count('fnWithPromise', 1));
        cb();
      });

      // value doesnt change on return value
      result.then((value) => {
        expect(value).to.be.equal(6);
      });
    });
  });

  describe('Decorator', () => {
    it('Correctly wraps class with zero arguments', () => {
      const construct = sinon.spy();
      const meth = sinon.spy();
      @debuk()
      class MyClass {
        constructor(n) {
          construct(n);
        }
        method(x) {
          meth(x);
        }
      }
      const instance = new MyClass(1);
      instance.method(2);
      expect(construct).have.been.calledWith(1);
      expect(meth).have.been.calledWith(2);
    });

    it('Correctly wraps class with options argument', (cb) => {
      const mockedConsole = mockConsole();
      @debuk({ console: mockedConsole })
      class MyClass {
        constructor(x) {
          this.x = x;
        }
      }
      const instance = new MyClass(1);
      expect(instance.x).to.be.equal(1);
      expect(mockedConsole.log).not.have.been.called;

      // check in a defer
      _.defer(() => {
        expect(mockedConsole.log)
          .have.been.calledWith(defaults.TEMPLATE.count('MyClass', 1));
        cb();
      });
    });

    it('Correctly wraps method', () => {
      class MyClass {
        constructor(x) {
          this.x = x;
        }
        @debuk()
        method() {
          return this.x;
        }
      }
      const instance = new MyClass(3);
      expect(instance.method()).to.be.equal(3);
    });
  });
});
