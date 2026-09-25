import Dexie, { type Table } from 'dexie';
import type { Client, Idea, Script, Task, CalendarEvent, Lead, Payment, FollowerSnapshot, Strategy, Settings, FocusSession, Habit, HabitCompletion, RewardEntry } from '../types/models';

class MarketeroDB extends Dexie {
  clients!: Table<Client, string>; ideas!: Table<Idea, string>; scripts!: Table<Script, string>; tasks!: Table<Task, string>;
  events!: Table<CalendarEvent, string>; leads!: Table<Lead, string>; payments!: Table<Payment, string>;
  followers!: Table<FollowerSnapshot, string>; strategies!: Table<Strategy, string>; settings!: Table<Settings, string>;
  focusSessions!: Table<FocusSession, string>; habits!: Table<Habit, string>; habitCompletions!: Table<HabitCompletion, string>;
  rewards!: Table<RewardEntry, string>;
  constructor(){
    super('marketero');
    this.version(1).stores({
      clients:'id,name,updatedAt,deletedAt', ideas:'id,clientId,status,updatedAt,deletedAt', scripts:'id,clientId,status,updatedAt,deletedAt',
      tasks:'id,clientId,dueAt,completed,urgent,updatedAt,deletedAt', events:'id,clientId,kind,startAt,endAt,updatedAt,deletedAt',
      leads:'id,status,nextFollowUpAt,updatedAt,deletedAt', payments:'id,clientId,dueDate,paidAt,updatedAt,deletedAt',
      followers:'id,clientId,platform,date,updatedAt,deletedAt', strategies:'id,clientId,approved,updatedAt,deletedAt', settings:'id,key'
    });
    this.version(2).stores({
      clients:'id,name,updatedAt,deletedAt', ideas:'id,clientId,status,updatedAt,deletedAt', scripts:'id,clientId,status,updatedAt,deletedAt',
      tasks:'id,clientId,dueAt,completed,urgent,updatedAt,deletedAt', events:'id,clientId,kind,startAt,endAt,updatedAt,deletedAt',
      leads:'id,status,nextFollowUpAt,updatedAt,deletedAt', payments:'id,clientId,dueDate,paidAt,updatedAt,deletedAt',
      followers:'id,clientId,platform,date,updatedAt,deletedAt', strategies:'id,clientId,approved,updatedAt,deletedAt', settings:'id,key',
      focusSessions:'id,startedAt,taskId,scriptId,updatedAt,deletedAt',
      habits:'id,name,archived,updatedAt,deletedAt',
      habitCompletions:'id,habitId,date,completed,updatedAt,deletedAt',
      rewards:'id,&actionKey,source,updatedAt,deletedAt'
    }).upgrade(async tx=>{
      await tx.table('scripts').toCollection().modify((s:any)=>{
        if(typeof s.recorded!=='boolean') s.recorded=false;
        if(typeof s.edited!=='boolean') s.edited=false;
        if(typeof s.scheduled!=='boolean') s.scheduled=false;
        if(typeof s.published!=='boolean') s.published=false;
      });
    });
  }
}
export const db = new MarketeroDB();
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export async function ensureSettings(){
  let s = await db.settings.get('settings');
  if(!s){
    s={id:'settings',key:'singleton',createdAt:now(),updatedAt:now(),firstRunDone:false,monthlyRevenueGoal:5000,clientGoal:10,darkMode:false,dateFormat:'it-IT',notificationsEnabled:true,clientReminders:true,appointmentReminders:true,autoLockMinutes:15};
    await db.settings.put(s);
  }
  return s;
}
