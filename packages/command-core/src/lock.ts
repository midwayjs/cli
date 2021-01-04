import * as EventEmitter from 'events';
enum LockStatus {
  Initial,
  Running,
  Success,
}
const statusMap = {};
export class Lock {
  type: string;
  event: any;
  resolveList: any[] = [];
  constructor(lockType) {
    this.type = lockType;
    statusMap[lockType] = LockStatus.Initial;
    this.event = new EventEmitter();
    this.event.on('success', this.success.bind(this));
  }

  async wait(callback?) {
    const status = statusMap[this.type];
    switch (status) {
      case LockStatus.Initial:
        statusMap[this.type] = LockStatus.Running;
        if (callback) {
          await callback();
        }
        statusMap[this.type] = LockStatus.Success;
        this.event.emit('success');
        break;
      case LockStatus.Running:
        await this.waitLock();
    }
  }

  waitLock() {
    return new Promise<void>(resolve => {
      if (statusMap[this.type] === LockStatus.Success) {
        resolve();
      } else {
        this.resolveList.push(resolve);
      }
    });
  }

  success() {
    statusMap[this.type] = LockStatus.Success;
    this.resolveList.forEach(resolve => {
      resolve();
    });
    this.event = null;
  }
}
